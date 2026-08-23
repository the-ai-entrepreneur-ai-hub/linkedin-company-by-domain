# Config check + platform Phase A run for 0reNPvdycTAAOpOYQ
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$a = Invoke-RestMethod -Uri "$base/acts/$id`?token=$t"
$p = $a.data.pricingInfos | Select-Object -Last 1
if ($p -and $p.pricingPerEvent) {
    "pricing: $($p.pricingModel)"
    $p.pricingPerEvent.actorChargeEvents.PSObject.Properties | ForEach-Object { "  event $($_.Name): `$$($_.Value.eventPriceUsd)" }
} else { "pricing: NONE FILED" }
"isPublic: $($a.data.isPublic)"
$mem = ($a.data.versions | Where-Object versionNumber -eq '0.1').memoryMbytes
"memoryMbytes(0.1): $mem"
"taggedBuilds.latest: $(($a.data.taggedBuilds.latest | ConvertTo-Json -Compress))"
