import React, { useState } from "react";
import { Upload, MapPin, ShieldAlert, Anchor, Activity } from "lucide-react";

export default function App() {
  const [file, setFile] = useState(null);
  const [passTime, setPassTime] = useState("2026-03-14T18:30");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a .tif file first");

    setIsProcessing(true);
    setResults(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("pass_time", passTime);

    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResults(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      {/* Corporate Header */}
      <header className="bg-white border-b border-gray-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="bg-blue-900 p-2 rounded-sm">
            <ShieldAlert className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">
              Marine Intelligence Terminal
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              SAR Attribution & Traffic Module
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Panel: Input Controls */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-sm border border-gray-300 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} /> Data Ingestion
                </h2>
              </div>

              <div className="p-5">
                <form onSubmit={handleUpload} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                      1. Sentinel-1 SAR Telemetry (.tif)
                    </label>
                    <input
                      type="file"
                      accept=".tif,.tiff"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-500 border border-gray-300 rounded-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-gray-100 file:text-gray-700 file:font-semibold hover:file:bg-gray-200 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                      2. UTC Timestamp Boundary
                    </label>
                    <input
                      type="datetime-local"
                      value={passTime}
                      onChange={(e) => setPassTime(e.target.value)}
                      className="block w-full border border-gray-300 rounded-sm shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>

                  <hr className="border-gray-200" />

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-sm text-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-900"
                  >
                    {isProcessing
                      ? "Executing Analysis..."
                      : "Initialize Routine"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-8">
            {isProcessing && (
              <div className="bg-white rounded-sm border border-gray-300 shadow-sm h-full min-h-[400px] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-4"></div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
                  Computing Intersections...
                </p>
              </div>
            )}

            {results && !isProcessing && (
              <div className="space-y-6">
                {/* 
                  SAFETY CHECK #1: If a spill was found, but NO ships were found, 
                  display a warning instead of crashing trying to read suspect[0]
                */}
                {results.suspects && results.suspects.length === 0 ? (
                  <div className="bg-yellow-50 rounded-sm border-l-4 border-yellow-500 p-6 shadow-sm">
                    <h3 className="text-yellow-800 font-bold uppercase tracking-widest mb-2">
                      Notice: No Traffic Found
                    </h3>
                    <p className="text-yellow-700 text-sm">
                      An oil spill centroid was detected at Latitude{" "}
                      {results.spill?.lat?.toFixed(4)}, Longitude{" "}
                      {results.spill?.lon?.toFixed(4)}. However, no tanker
                      traffic was found in the AIS logs within the specified
                      time boundary.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Primary Target Card */}
                    <div className="bg-white rounded-sm border-l-4 border-l-red-600 border-y border-r border-gray-300 shadow-sm overflow-hidden">
                      <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-start">
                        <div>
                          <span className="inline-block px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm mb-2">
                            Primary Target
                          </span>
                          <h3 className="text-2xl font-black text-gray-900">
                            {results.suspects[0]?.name || "UNKNOWN VESSEL"}
                          </h3>
                          <p className="text-sm text-gray-600 font-mono mt-1">
                            MMSI: {results.suspects[0]?.mmsi || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Detected Origin
                          </p>
                          <p className="font-mono text-gray-900 flex items-center gap-1 justify-end mt-1 font-semibold bg-white px-2 py-1 border border-gray-200 rounded-sm">
                            <MapPin size={14} className="text-red-600" />
                            {/* SAFETY CHECK #2: Optional chaining (?.lat) in case coordinates failed */}
                            {results.spill?.lat?.toFixed(4) || "0.0000"},{" "}
                            {results.spill?.lon?.toFixed(4) || "0.0000"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-white">
                        <div className="p-4">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Proximity (NM)
                          </p>
                          <p className="text-lg font-mono font-bold text-gray-900 mt-1">
                            {results.suspects[0]?.dist || "0.0"}
                          </p>
                        </div>
                        <div className="p-4 bg-red-50/30">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Speed Over Ground
                          </p>
                          <p
                            className={`text-lg font-mono font-bold mt-1 ${
                              results.suspects[0]?.speed < 4
                                ? "text-red-700"
                                : "text-gray-900"
                            }`}
                          >
                            {results.suspects[0]?.speed || "0.0"}{" "}
                            <span className="text-sm font-sans text-gray-500 font-normal">
                              kts
                            </span>
                          </p>
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Log Timestamp
                          </p>
                          <p className="text-lg font-mono font-bold text-gray-900 mt-1">
                            {/* SAFETY CHECK #3: Prevent split() crash if time string is missing */}
                            {results.suspects[0]?.time?.split(" ")[1] ||
                              results.suspects[0]?.time ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Traffic Table (Only renders if there is more than 1 ship) */}
                    {results.suspects.length > 1 && (
                      <div className="bg-white rounded-sm border border-gray-300 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <Anchor size={16} /> Regional Traffic Correlates
                          </h3>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Vessel Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  MMSI
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Distance
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Speed
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {results.suspects.slice(1).map((ship, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {ship.name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                    {ship.mmsi}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-right">
                                    {ship.dist}{" "}
                                    <span className="text-gray-400 font-sans text-xs">
                                      NM
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right">
                                    <span
                                      className={`px-2 py-1 rounded-sm ${
                                        ship.speed < 4
                                          ? "bg-red-100 text-red-700 font-bold"
                                          : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {ship.speed}{" "}
                                      <span className="font-sans text-xs opacity-75">
                                        kts
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}