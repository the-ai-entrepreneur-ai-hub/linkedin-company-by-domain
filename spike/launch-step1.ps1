# Launch sequence for linkedin-company-by-domain (0reNPvdycTAAOpOYQ)
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$ErrorActionPreference = 'Stop'
$base = 'https://api.apify.com/v2'
$tok = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

# 1) point latest tag at version 0.1
$b = @{ versionNumber = '0.1'; buildTag = 'latest' } | ConvertTo-Json
$r = Invoke-RestMethod -Method Put -Uri "$base/acts/$id/versions/0.1?token=$tok" -ContentType 'application/json' -Body $b
"version PUT: buildTag=$($r.data.buildTag)"

# 2) rebuild with tag=latest
$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$tok&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"build latest: $($r2.data.status) number=$($r2.data.buildNumber)"

# 3) inspect config
$a = Invoke-RestMethod -Uri "$base/acts/$id?token=$tok"
$p = $a.data.pricingInfos | Select-Object -Last 1
if ($p) {
    "pricing model: $($p.pricingModel)"
    if ($p.pricingPerEvent) {
        $p.pricingPerEvent.actorChargeEvents.PSObject.Properties | ForEach-Object { "  event $($_.Name): `$$($_.Value.eventPriceUsd)" }
    }
} else { "pricing: NONE FILED" }
"isPublic: $($a.data.isPublic)"
"version memoryMbytes: $($a.data.versions | Where-Object { $_.versionNumber -eq '0.1' } | Select-Object -ExpandProperty memoryMbytes -ErrorAction SilentlyContinue)"
