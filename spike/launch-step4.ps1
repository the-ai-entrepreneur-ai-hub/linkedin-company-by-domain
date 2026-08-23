# File initial pricing + fix memory BEFORE first publish
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

# 1) read full version, patch memory, put back whole object
$v = Invoke-RestMethod -Uri "$base/acts/$id/versions/0.1`?token=$t"
$obj = $v.data
$obj.memoryMbytes = 1024
$json = $obj | ConvertTo-Json -Depth 20
$r = Invoke-RestMethod -Method Put -Uri "$base/acts/$id/versions/0.1`?token=$t" -ContentType 'application/json' -Body $json
"version patched: memory=$($r.data.memoryMbytes) buildTag=$($r.data.buildTag)"

# rebuild so runtime defaults reflect the version change
$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"rebuild latest: $($r2.data.status) $($r2.data.buildNumber)"

# 2) append initial PPE pricing (nested format; unpublished => immediate)
$now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffK')
$priceBody = @{
    pricingInfos = @(
        @{
            pricingModel = 'PAY_PER_EVENT'
            startedAt    = $now
            pricingPerEvent = @{
                actorChargeEvents = @{
                    'apify-actor-start' = @{
                        eventTitle       = 'Actor start'
                        eventDescription = 'One-time fee charged when the run begins.'
                        eventPriceUsd    = 0.002
                    }
                    'company-resolved' = @{
                        eventTitle       = 'Verified company resolved'
                        eventDescription = 'Charged only when a domain resolves to its LinkedIn company page at medium or high confidence. Unresolved domains are free.'
                        eventPriceUsd    = 0.0075
                    }
                }
            }
        }
    )
} | ConvertTo-Json -Depth 12
$r3 = Invoke-RestMethod -Method Put -Uri "$base/acts/$id`?token=$t" -ContentType 'application/json' -Body $priceBody
$p = $r3.data.pricingInfos | Select-Object -Last 1
"pricing filed: model=$($p.pricingModel) startedAt=$($p.startedAt)"
$p.pricingPerEvent.actorChargeEvents.PSObject.Properties | ForEach-Object { "  $($_.Name): `$$($_.Value.eventPriceUsd)" }
