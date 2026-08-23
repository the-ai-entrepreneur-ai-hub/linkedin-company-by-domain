# Rebuild with fixed output schema, then publish
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

apify push -w 240 --version 0.1 2>&1 | Select-Object -Last 3
$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"rebuild latest: $($r2.data.status) $($r2.data.buildNumber)"

$pub = @{
    isPublic   = $true
    categories = @('LEAD_GENERATION', 'AI')
    title      = 'LinkedIn Company by Domain - Verified Finder API'
    description = 'Find the LinkedIn company page for any website domain. Resolve LinkedIn company by domain with verified matching: a row bills only when the site and the LinkedIn page agree. Employee count, followers, free 30-day cache, free monitoring diffs. Batch up to 50,000 domains. No login.'
    seoTitle   = 'Domain to LinkedIn Company Finder - Verified API'
    seoDescription = 'Resolve any website domain to its verified LinkedIn company page. LinkedIn company by domain finder API. Mutual-evidence matching, batch up to 50k domains. No cookies.'
} | ConvertTo-Json -Depth 6
try {
    $r3 = Invoke-RestMethod -Method Put -Uri "$base/acts/$id`?token=$t" -ContentType 'application/json' -Body $pub
    "PUBLISHED: isPublic=$($r3.data.isPublic) categories=$($r3.data.categories -join ',')"
} catch {
    "PUBLISH FAILED: $($_.ErrorDetails.Message)"
}
