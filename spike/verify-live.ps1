. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'

# 1) public actor endpoint (no token — what the world sees)
$a = Invoke-RestMethod -Uri "$base/acts/george.the.developer~linkedin-company-by-domain"
"public: name=$($a.data.name) title=$($a.data.title)"
"isPublic=$($a.data.isPublic) username=$($a.data.username)"
$p = $a.data.pricingInfos | Select-Object -Last 1
"pricing: $($p.pricingModel) startedAt=$($p.startedAt)"
$p.pricingPerEvent.actorChargeEvents.PSObject.Properties | ForEach-Object { "  $($_.Name): `$$($_.Value.eventPriceUsd)" }
"categories: $($a.data.categories -join ',')"
"stats: totalRuns=$($a.data.stats.totalRuns) totalUsers=$($a.data.stats.totalUsers)"

# 2) store search presence
$s = Invoke-RestMethod -Uri "$base/store?search=linkedin%20company%20by%20domain&limit=10"
$pos = 0; $found = $false
foreach ($it in $s.data.items) { $pos++; if ($it.username -eq 'george.the.developer') { $found = $true; break } }
"store search 'linkedin company by domain': george position=$pos found=$found (of $($s.data.total))"
