. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$id = '0reNPvdycTAAOpOYQ'
$a = Invoke-RestMethod -Uri "$base/acts/$id" -Headers @{ 'X-API-Token' = $env:APIFY_TOKEN }
$p = $a.data.pricingInfos | Select-Object -Last 1
if ($p) {
    "pricing model: $($p.pricingModel)"
    if ($p.pricingPerEvent) {
        $p.pricingPerEvent.actorChargeEvents.PSObject.Properties | ForEach-Object { "  event $($_.Name): `$$($_.Value.eventPriceUsd)" }
    } else { "  raw: $($p | ConvertTo-Json -Depth 5)" }
} else { "pricing: NONE FILED" }
"isPublic: $($a.data.isPublic)"
"name: $($a.data.username)/$($a.data.name)"
$mem = ($a.data.versions | Where-Object versionNumber -eq '0.1').memoryMbytes
"memoryMbytes: $mem"
$tagged = $a.data.taggedBuilds | ConvertTo-Json -Depth 4
"taggedBuilds: $tagged"
