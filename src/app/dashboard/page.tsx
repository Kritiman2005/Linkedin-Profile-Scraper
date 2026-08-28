'use client'

import { useState } from 'react'

export default function DashboardPage() {
  const [liAt, setLiAt] = useState('')
  const [jsessionid, setJsessionid] = useState('')
  const [userAgent, setUserAgent] = useState('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  const [url, setUrl] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTestRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResponse(null)

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            linkedinUrl: url,
            liAt: liAt,
            jsessionid: jsessionid,
            userAgent: userAgent
        }),
      })

      const data = await res.json()
      setResponse(data)

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">LinkedIn API Dashboard</h1>
          <p className="mt-2 text-gray-600">Test the Bring-Your-Own-Cookie (BYOC) Scraper.</p>
        </div>

        {/* Credentials Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">1. Enter Your Credentials</h2>
          <p className="text-sm text-gray-600 mb-6">
            Log in to LinkedIn in your browser, open Developer Tools (F12) &gt; Application &gt; Cookies, and paste your active session cookies below.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="liAt" className="block text-sm font-medium text-gray-700">li_at Cookie</label>
              <input
                type="password"
                id="liAt"
                required
                value={liAt}
                onChange={(e) => setLiAt(e.target.value)}
                placeholder="AQEDATO..."
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label htmlFor="jsessionid" className="block text-sm font-medium text-gray-700">JSESSIONID Cookie</label>
              <input
                type="password"
                id="jsessionid"
                required
                value={jsessionid}
                onChange={(e) => setJsessionid(e.target.value)}
                placeholder="ajax:493..."
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label htmlFor="userAgent" className="block text-sm font-medium text-gray-700">User-Agent (Optional)</label>
              <input
                type="text"
                id="userAgent"
                required
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-500 bg-gray-50 focus:ring-black focus:border-black"
              />
            </div>
          </div>
        </div>

        {/* Test Request Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">2. Scrape a Profile</h2>
          <form onSubmit={handleTestRequest} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                id="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://linkedin.com/in/satyanadella"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:ring-black focus:border-black"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } transition`}
            >
              {loading ? 'Fetching via your cookies...' : 'Extract Profile'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {response && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Response</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm max-h-96">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
