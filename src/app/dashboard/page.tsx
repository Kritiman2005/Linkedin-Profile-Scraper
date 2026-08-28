'use client'

import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string>('')
  const [url, setUrl] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // In a real app, this would fetch the user's key from the DB
    setApiKey('tk_live_mock1234567890abcdef')
  }, [])

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
        body: JSON.stringify({ linkedinUrl: url }),
      })

      const data = await res.json()

      // Always set response so we can see the diagnostics payload
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
          <p className="mt-2 text-gray-600">Manage your API keys and test requests.</p>
        </div>

        {/* API Key Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Your API Key</h2>
          <div className="flex items-center space-x-4">
            <code className="bg-gray-100 px-4 py-2 rounded text-sm text-gray-800 flex-1 break-all">
              {apiKey || 'Loading...'}
            </code>
            <button className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition">
              Copy
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Pass this key in the <code>x-api-key</code> header for all requests.
          </p>
        </div>

        {/* Test Request Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Test a Request</h2>
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
                placeholder="https://linkedin.com/in/username"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:ring-black focus:border-black"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } transition`}
            >
              {loading ? 'Fetching...' : 'Extract Profile'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {response && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Response</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
