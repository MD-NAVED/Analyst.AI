# DataLens AI 🔍📊

DataLens AI is a powerful data analysis and visualization tool powered by the **Google Gemini API**. It allows users to upload datasets (CSV, Excel) and automatically gain insights, interactive charts, and downloadable reports.

## ✨ Features

- **Automated Insights**: Leverages Gemini to analyze your data and extract meaningful insights.
- **Interactive Visualizations**: Beautiful, interactive charts powered by Recharts.
- **Export to PDF**: Easily export your analysis and charts into a PDF report.
- **Modern UI**: Clean and responsive user interface built with React, TailwindCSS, and Framer Motion.
- **Multiple Formats**: Support for both CSV (`papaparse`) and Excel (`xlsx`) file uploads.

## 🚀 Run Locally

**Prerequisites:** Node.js installed on your machine.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment Variables:**
   Rename `.env.example` to `.env.local` and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: TailwindCSS v4, Lucide React, Motion
- **Data Handling**: PapaParse, XLSX
- **Visualization**: Recharts
- **Export**: HTML2Canvas, jsPDF
- **AI Integration**: `@google/genai`

