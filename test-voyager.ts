import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
    const liAt = process.env.LINKEDIN_LI_AT
    const jsessionid = process.env.LINKEDIN_JSESSIONID
    const csrfToken = jsessionid?.replace(/"/g, '')

    const profileUrn = 'ACoAAFVriN8B16rOVjxQUA1O9nM5_atH9PgGkv8' // URN for Jiban

    const queryId = 'voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a'
    const graphqlUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${profileUrn})&queryId=${queryId}`

    const gqlRes = await fetch(graphqlUrl, {
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'csrf-token': csrfToken || '',
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'x-li-lang': 'en_US'
      }
    })

    console.log('Status:', gqlRes.status)
    const json = await gqlRes.json()
    console.log('Included length:', json.included?.length)
    
    // Check if the payload contains the full profile or if it's restricted
    let hasCompany = false
    if (json.included) {
        for (const item of json.included) {
            if (item.companyName) hasCompany = true
        }
    }
    console.log('Has Experience Data?', hasCompany)
}
run()
