# Aquaculture Alerts & Risk Monitoring

This package includes a prebuilt React dashboard and a FastAPI backend. **Node.js is not required to run the included dashboard**; Python is required.

## Run on Windows without Node.js

1. Extract the ZIP so the `backend` folder is inside your project folder.
2. Open PowerShell in the `backend` folder.
3. If your existing project has a `.venv` folder one level above `backend`, activate it:

   ```powershell
   ..\.venv\Scripts\Activate.ps1
   ```

   If you do not have that environment, use Python 3.11 and install the requirements below.
4. Install dependencies if needed:

   ```powershell
   python -m pip install -r requirements.txt
   ```

5. Start the server:

   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

6. Open **http://127.0.0.1:8000** for the dashboard and **http://127.0.0.1:8000/docs** for API testing.

The packaged dashboard calls the FastAPI API on the same origin. Water predictions, disease image predictions, alert history, and replay use the real backend routes. The replay endpoint is intentionally marked demo data.

## Browser notifications

Open the dashboard on `http://localhost:8000` or `http://127.0.0.1:8000`, click **Enable Notifications**, and allow permission. Use the notification test button to check browser permission. Real medium/high-risk API alerts can trigger browser notifications while the dashboard is running. Ordinary browser notifications do not guarantee delivery while the browser/page is closed; that requires a push service and server-side push subscription handling.

## Important model notes

- Disease classification uses the included Keras models for the category selected in the dashboard. Optional CLIP (`torch` and `transformers`) is only needed if API clients omit the category and expect automatic animal-category detection.
- Water and disease predictions are decision-support estimates, not a substitute for an aquaculture expert's assessment. Validate thresholds and model accuracy before real farm use.
- Alerts, sensor readings, and assessment logs are permanently persisted in SQLite (`backend/aquaculture.db`). All history survives server restarts.

## Running Tests

### Backend Unit Tests (Python)

From the `backend` folder:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

### Frontend Tests (Node.js / TypeScript)

From the project root:

```powershell
npm test
```
