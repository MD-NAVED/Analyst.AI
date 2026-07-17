import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log('⚡ [DataLens DB] Connecting to Supabase URL:', supabaseUrl || 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing in .env — auth and storage will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────

/** Sign up with email + password + display name */
export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);

  // Insert profile row
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      name,
      plan: 'free',
    });
  }
  return data.user;
};

/** Sign in with email + password */
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
};

/** Sign in with Google OAuth */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(error.message);
};

/** Sign out */
export const signOut = async () => {
  await supabase.auth.signOut();
};

/** Get currently logged-in user (from session) */
export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
};

// ─── DATASET STORAGE HELPERS ──────────────────────────────────────────────────

const BUCKET = 'datasets';

/** Upload a raw file to Supabase Storage under user's folder */
export const uploadDatasetFile = async (
  userId: string,
  file: File
): Promise<string> => {
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw new Error(error.message);
  return filePath;
};

/** Save dataset metadata to DB */
export const saveDatasetMeta = async (meta: {
  userId: string;
  name: string;
  filePath: string;
  rows: number;
  columns: number;
  sizeBytes: number;
}) => {
  const { data, error } = await supabase.from('datasets').insert({
    user_id: meta.userId,
    name: meta.name,
    file_path: meta.filePath,
    rows: meta.rows,
    columns: meta.columns,
    size_bytes: meta.sizeBytes,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
};

/** List all datasets for a user */
export const listUserDatasets = async (userId: string) => {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
};

/** Get a signed download URL for a dataset file (valid 1 hour) */
export const getDatasetDownloadUrl = async (filePath: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
};

/** Delete a dataset (file + metadata) */
export const deleteDataset = async (datasetId: string, filePath: string) => {
  await supabase.storage.from(BUCKET).remove([filePath]);
  await supabase.from('datasets').delete().eq('id', datasetId);
};

// ─── CHAT HISTORY HELPERS ─────────────────────────────────────────────────────

/** Save or update chat history for a dataset */
export const saveChatHistory = async (
  userId: string,
  datasetId: string,
  messages: any[]
) => {
  const { error } = await supabase.from('chat_history').upsert({
    user_id: userId,
    dataset_id: datasetId,
    messages,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,dataset_id' });
  if (error) console.error('Chat save error:', error.message);
};

/** Load chat history for a dataset */
export const loadChatHistory = async (userId: string, datasetId: string) => {
  const { data } = await supabase
    .from('chat_history')
    .select('messages')
    .eq('user_id', userId)
    .eq('dataset_id', datasetId)
    .single();
  return data?.messages ?? null;
};
