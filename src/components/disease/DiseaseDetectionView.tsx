import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Microscope, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Info,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Languages
} from 'lucide-react';
import { DiseaseDetectionResult, ApiAlert } from '../../types/aquaculture';
import { SAMPLE_IMAGES } from '../../lib/mockData';
import { api } from '../../lib/api';

interface DiseaseDetectionViewProps {
  currentLanguage: 'kn' | 'hi' | 'en';
  onAlertGenerated?: (alert: ApiAlert) => void;
}

export const DiseaseDetectionView: React.FC<DiseaseDetectionViewProps> = ({
  currentLanguage,
  onAlertGenerated,
}) => {
  // Image state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form fields
  const [species, setSpecies] = useState('Nile Tilapia (finfish)');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DiseaseDetectionResult | null>(null);
  const [latestAlert, setLatestAlert] = useState<ApiAlert | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const symptomOptions = [
    'Fin margin erosion / ragged tail',
    'White epidermal cysts / Ich spots',
    'Open skin ulcers / hemorrhagic lesions',
    'Cloudy or protruding eye (Exophthalmia)',
    'Lethargic surface swimming / piping',
    'Gill pallor or excessive mucus',
  ];

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleFileProcess = (file: File) => {
    setUploadError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!validTypes.includes(file.type)) {
      setUploadError('Unsupported format. Please upload a JPG, JPEG, PNG, or WebP image file.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Image size exceeds 20MB. Please choose a smaller image.');
      return;
    }

    setSelectedFile(file);
    setImageFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setAnalysisResult(null);
      setLatestAlert(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Helper to load sample specimen image for easy testing
  const loadSampleSpecimen = async (imageUrl: string, filename: string) => {
    setUploadError(null);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      setSelectedFile(file);
      setSelectedImage(imageUrl);
      setImageFileName(filename);
      setAnalysisResult(null);
      setLatestAlert(null);
    } catch {
      setUploadError('Could not load sample image asset.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setImageFileName('');
    setAnalysisResult(null);
    setLatestAlert(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Call POST /disease/predict
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setUploadError('Please select or upload a specimen photograph before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    setUploadError(null);

    const lang = currentLanguage === 'hi' ? 'hi' : 'kn';
    // Map dropdown to category override
    let categoryParam = 'finfish';
    if (species.toLowerCase().includes('shrimp') || species.toLowerCase().includes('prawn')) {
      categoryParam = 'shrimp';
    } else if (species.toLowerCase().includes('seaweed')) {
      categoryParam = 'seaweed';
    } else if (species.toLowerCase().includes('oyster') || species.toLowerCase().includes('bivalve')) {
      categoryParam = 'bivalve';
    }

    try {
      const res = await api.predictDisease(
        selectedFile,
        'pond_01',
        categoryParam,
        lang
      );

      const pred = res.prediction;
      const modelResult = pred.model_result || {};
      const risk = pred.risk_level || 'low';
      const isHealthy = risk === 'low';
      const label = modelResult.label || (isHealthy ? 'Healthy Specimen' : 'Pathology Detected');
      const conf = Math.round((pred.risk_score || 0.85) * 100);

      const result: DiseaseDetectionResult = {
        id: `diag-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        imagePreview: selectedImage || '',
        species: species,
        diseaseName: label,
        category: (modelResult.category || categoryParam).toUpperCase(),
        confidenceScore: conf,
        isHealthy: isHealthy,
        riskLevel: risk as any,
        commonSymptoms: isHealthy
          ? ['Intact epidermis and scales', 'Uniform pigmentation', 'Clear ocular lens']
          : selectedSymptoms.length > 0
          ? selectedSymptoms
          : ['Lesion / epidermal abnormality identified by model', 'Abnormal coloration / tissue erosion'],
        recommendedActions: [pred.recommended_action],
        veterinaryAdvisory: isHealthy
          ? 'Regular water monitoring and standard feed distribution should be maintained.'
          : 'High-risk pathogen indicator identified. Isolate afflicted cohort and consult an aquaculture veterinarian immediately.',
        alert: res.alert,
        rawResponse: res,
      };

      setAnalysisResult(result);
      setLatestAlert(res.alert);

      if (res.alert && onAlertGenerated) {
        onAlertGenerated(res.alert);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Disease prediction failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wide">
              <span>Aquatic Biosecurity · Multi-Category Model Inference</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Fish Disease Detection &amp; Diagnosis
            </h1>
            <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
              Upload specimen photographs to execute Stage-1 animal identification and Stage-2 Keras deep learning disease diagnosis (Finfish, Shrimp, Seaweed, Bivalves).
            </p>
          </div>

          {/* Sample quick buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadSampleSpecimen(SAMPLE_IMAGES.healthyTilapia, 'healthy_tilapia_specimen.jpg')}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              Sample: Healthy Fish
            </button>
            <button
              type="button"
              onClick={() => loadSampleSpecimen(SAMPLE_IMAGES.diseasedFish, 'bacterial_lesion_specimen.jpg')}
              className="px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
            >
              Sample: Diseased Fish
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Upload & Specimen Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* A. Image Upload Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-600" />
              <span>Specimen Image Upload</span>
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="fish-image-input"
            />

            {!selectedImage ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/50'
                    : 'border-slate-300 hover:border-teal-400 bg-slate-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Click to upload or drag and drop image
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports JPG, JPEG, PNG, and WebP (Max 20MB)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
                >
                  Choose Image File
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 aspect-4/3 max-h-80 flex items-center justify-center">
                  <img
                    src={selectedImage}
                    alt="Uploaded specimen preview"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-mono text-slate-600 truncate max-w-xs">
                    {imageFileName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div className="space-y-1">
                  <span className="font-semibold">{uploadError}</span>
                  <p className="text-[11px] text-red-700">
                    If your FastAPI server is running on Windows, make sure it is launched with <code className="font-mono bg-red-100 px-1 py-0.5 rounded">uvicorn main:app --port 8000</code>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* B. Specimen Classification & Clinical Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Specimen Metadata &amp; Observations
            </h2>

            <div className="space-y-1.5">
              <label htmlFor="fish-species" className="text-xs font-semibold text-slate-700 block">
                Target Category / Species (Passed to Model)
              </label>
              <select
                id="fish-species"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Nile Tilapia (finfish)">Nile Tilapia (finfish / fish_model.keras)</option>
                <option value="Common Carp (finfish)">Common Carp (finfish / fish_model.keras)</option>
                <option value="Vannamei Shrimp (shrimp)">Vannamei Shrimp (shrimp / fish_model.keras)</option>
                <option value="Cultured Seaweed (seaweed)">Cultured Seaweed (seaweed / fish_model.keras)</option>
                <option value="Cultured Oyster (bivalve)">Cultured Oyster (bivalve shell gaping rule)</option>
              </select>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Visible Lesions &amp; Clinical Signs
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {symptomOptions.map((opt) => {
                  const checked = selectedSymptoms.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-teal-50/60 border-teal-300 text-teal-950 font-medium'
                          : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleSymptomToggle(opt)}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Analyze Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedFile}
                className={`w-full py-3 px-4 font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 focus:outline-none cursor-pointer ${
                  !selectedFile
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-teal-700 hover:bg-teal-800 text-white'
                }`}
              >
                <Microscope className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing Specimen with AI...' : 'Analyze Specimen Health'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real Diagnostic Inference Result */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Diagnostic Inference Result</span>
              </h2>
            </div>

            {!analysisResult ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Microscope className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">No Specimen Analyzed Yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Upload a fish photo or pick one of the sample specimen buttons, then click &ldquo;Analyze Specimen&rdquo;.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Result Status Banner */}
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    analysisResult.isHealthy
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Model Diagnosis · {analysisResult.category}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        analysisResult.isHealthy
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {analysisResult.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 pt-1">
                    {analysisResult.isHealthy ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="text-base font-bold leading-snug">
                        {analysisResult.diseaseName}
                      </h3>
                      <p className="text-xs font-mono mt-0.5 opacity-80">
                        Inference Confidence: {analysisResult.confidenceScore}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Morphological Signs */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Key Biological Observations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {analysisResult.commonSymptoms.map((sym, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span>{sym}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Actions */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Prescribed Aquaculture Actions
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {analysisResult.recommendedActions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Multilingual Dispatched Alert Box */}
                {latestAlert && (
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold tracking-wide uppercase text-amber-300">
                          Dispatched Alert Notification
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {latestAlert.risk_level.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs pt-1">
                      <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-[10px] font-semibold text-teal-400 block mb-0.5">
                          English Alert:
                        </span>
                        <p className="font-medium text-slate-100">{latestAlert.message.en}</p>
                      </div>

                      <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-[10px] font-semibold text-teal-400 block mb-0.5">
                          {currentLanguage === 'hi' ? 'Hindi Alert (हिंदी):' : 'Kannada Alert (ಕನ್ನಡ):'}
                        </span>
                        <p className="font-medium text-slate-100">
                          {latestAlert.message[currentLanguage === 'hi' ? 'hi' : 'kn'] || latestAlert.message.en}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mandatory Notice */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Veterinary Biosecurity Notice</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-amber-900/90">
                    {analysisResult.veterinaryAdvisory}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
