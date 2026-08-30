"use client";

import { useState } from "react";
import Image from "next/image";

type ProfileData = {
  profileUrl: string;
  name: string;
  headline: string;
  location: string;
  about: string;
  experience: {
    title: string;
    company: string;
    duration: string;
    description: string;
    logoUrl?: string;
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
    years: string;
    logoUrl?: string;
  }[];
  skills: string[];
  certifications: {
    name: string;
    issuer: string;
    date: string;
  }[];
  languages: string[];
  profileImageUrl: string | null;
  scrapedAt: string;
  source: string;
};

export default function Dashboard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setProfile(null);

    try {
      const res = await fetch("/api/v1/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: url }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.data);
      } else {
        setError(data.error || "Failed to scrape profile.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2ef] font-sans pb-16">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#0a66c2] fill-current">
              <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
            </svg>
            <span className="font-bold text-xl text-gray-900 hidden sm:block">API Dashboard</span>
          </div>
          
          <form onSubmit={handleScrape} className="flex-1 max-w-md mx-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-md leading-5 bg-[#eef3f8] text-gray-900 placeholder-gray-600 focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-[#0a66c2] sm:text-sm transition-colors"
              placeholder="Paste LinkedIn URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </form>
          
          <div className="flex items-center space-x-4">
             <button
              onClick={handleScrape}
              disabled={loading}
              className="bg-[#0a66c2] hover:bg-[#004182] text-white px-4 py-1.5 rounded-full font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Scraping..." : "Scrape"}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-8 px-4 sm:px-6 lg:px-8">
        
        {loading && (
          <div className="flex flex-col items-center justify-center mt-20 space-y-4">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-[#0a66c2] rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">Bypassing WAF & Fetching Profile...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mt-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {profile && !loading && (
          <div className="space-y-4">
            {/* Top Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              {/* Cover Banner */}
              <div className="h-32 sm:h-48 bg-gradient-to-r from-gray-300 to-gray-200 relative">
                 <img src="https://static.licdn.com/aero-v1/sc/h/55k1z8997gh8dwtihm11aajyq" alt="Background" className="w-full h-full object-cover opacity-50" />
              </div>
              
              <div className="px-6 pb-6 relative">
                {/* Profile Image */}
                <div className="absolute -top-16 sm:-top-24 left-6">
                  {profile.profileImageUrl ? (
                    <img 
                      src={profile.profileImageUrl} 
                      alt={profile.name} 
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white shadow-sm object-cover bg-white"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white shadow-sm bg-gray-200 flex items-center justify-center text-4xl font-semibold text-gray-500">
                      {profile.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Profile Info */}
                <div className="pt-20 sm:pt-20 flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{profile.name}</h1>
                    <p className="text-gray-900 mt-1 text-base max-w-lg">{profile.headline}</p>
                    <p className="text-gray-500 text-sm mt-1">{profile.location} <span className="mx-1">•</span> <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:underline font-semibold">Contact info</a></p>
                  </div>
                  
                  {/* Current Company (if present) */}
                  {profile.experience && profile.experience.length > 0 && (
                     <div className="hidden sm:flex items-center space-x-2 w-56">
                        <div className="w-8 h-8 bg-gray-100 flex-shrink-0 flex items-center justify-center rounded">
                           <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 truncate hover:text-[#0a66c2] cursor-pointer hover:underline">{profile.experience[0].company}</span>
                     </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex space-x-2">
                  <button className="bg-[#0a66c2] hover:bg-[#004182] text-white px-5 py-1.5 rounded-full font-semibold text-base transition-colors">
                    Connect
                  </button>
                  <button className="border border-[#0a66c2] text-[#0a66c2] hover:bg-blue-50 px-5 py-1.5 rounded-full font-semibold text-base transition-colors border-2">
                    Message
                  </button>
                </div>
              </div>
            </div>

            {/* About Section */}
            {profile.about && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">About</h2>
                <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{profile.about}</p>
              </div>
            )}

            {/* Experience Section */}
            {profile.experience && profile.experience.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Experience</h2>
                <div className="space-y-6">
                  {profile.experience.map((exp, idx) => (
                    <div key={idx} className="flex space-x-4">
                      {exp.logoUrl ? (
                         <img src={exp.logoUrl} alt={exp.company} className="w-12 h-12 flex-shrink-0 object-contain rounded" />
                      ) : (
                         <div className="w-12 h-12 bg-gray-100 flex-shrink-0 flex items-center justify-center rounded">
                            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                         </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{exp.title}</h3>
                        <p className="text-gray-900 text-sm">{exp.company}</p>
                        {exp.duration && <p className="text-gray-500 text-sm">{exp.duration}</p>}
                        {exp.description && <p className="text-gray-700 text-sm mt-2 whitespace-pre-wrap">{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education Section */}
            {profile.education && profile.education.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Education</h2>
                <div className="space-y-6">
                  {profile.education.map((edu, idx) => (
                    <div key={idx} className="flex space-x-4">
                      {edu.logoUrl ? (
                         <img src={edu.logoUrl} alt={edu.school} className="w-12 h-12 flex-shrink-0 object-contain rounded" />
                      ) : (
                         <div className="w-12 h-12 bg-gray-100 flex-shrink-0 flex items-center justify-center rounded">
                            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                         </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{edu.school}</h3>
                        <p className="text-gray-900 text-sm">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</p>
                        {edu.years && <p className="text-gray-500 text-sm">{edu.years}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
