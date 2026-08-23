# Final tune (memory 512) + PUBLISH
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

# 1) memory 512 (measured memMax was 109MB)
$rb = Invoke-RestMethod -Method Put -Uri "$base/acts/$id`?token=$t" -ContentType 'application/json' -Body '{"defaultRunOptions":{"build":"latest","memoryMbytes":512,"timeoutSecs":3600,"maxTotalChargeUsd":25}}'
"defaultRunOptions: $($rb.data.defaultRunOptions | ConvertTo-Json -Compress)"

# rebuild so nothing stale serves latest
$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"rebuild latest: $($r2.data.status) $($r2.data.buildNumber)"

# 2) PUBLISH: isPublic + categories + listing copy (title/desc/seos already on actor.json via CLI push)
$pub = @{
    isPublic   = $true
    categories = @('LEAD_GENERATION', 'AI')
    title      = 'LinkedIn Company by Domain - Verified Finder API'
    description = 'Find the LinkedIn company page for any website domain. Resolve LinkedIn company by domain with verified matching: a row bills only when the site and the LinkedIn page agree. Employee count, followers, free 30-day cache, free monitoring diffs. Batch up to 50,000 domains. No login.'
    seoTitle   = 'Domain to LinkedIn Company Finder - Verified API'
    seoDescription = 'Resolve any website domain to its verified LinkedIn company page. LinkedIn company by domain finder API. Mutual-evidence matching, batch up to 50k domains. No cookies.'
} | ConvertTo-Json -Depth 6
$r3 = Invoke-RestMethod -Method Put -Uri "$base/acts/$id`?token=$t" -ContentType 'application/json' -Body $pub
"PUBLISHED: isPublic=$($r3.data.isPublic) categories=$($r3.data.categories -join ',')"
"listing url: https://apify.com/george.the.developer/linkedin-company-by-domain"
$p = $r3.data.pricingInfos | Select-Object -Last 1
"pricing live: $($p.pricingModel)"
