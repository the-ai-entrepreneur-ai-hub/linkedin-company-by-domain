# Platform Phase A: run actor on the 46-domain truth set
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$domains = @(
  'stripe.com','vercel.com','gitlab.com','notion.so','zapier.com','figma.com',
  'datadoghq.com','cloudflare.com','hubspot.com','dropbox.com','asana.com','airtable.com',
  'linear.app','slack.com','zoom.us','adobe.com','nvidia.com','spotify.com',
  'pinterest.com','discord.com','atlassian.com','canva.com','mailchimp.com','intercom.com',
  'loom.com','calendly.com','doordash.com','instacart.com','lyft.com','airbnb.com',
  'netflix.com','hulu.com','crunchbase.com','producthunt.com','substack.com','ghost.org',
  'webflow.com','wix.com','squarespace.com','godaddy.com','namecheap.com','digitalocean.com',
  'vultr.com','twilio.com','sendgrid.com','basecamp.com'
)
$input = @{
  domains           = $domains
  mode              = 'resolve'
  includeUnresolved = $true
  maxDomains        = 50
  concurrency       = 6
  forceRefresh      = $true
} | ConvertTo-Json -Depth 6

$run = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/runs?token=$t" -ContentType 'application/json' -Body $input
$runId = $run.data.id
"run started: $runId"

$status = ''
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 15
    $s = Invoke-RestMethod -Uri "$base/acts/$id/runs/$runId`?token=$t"
    $status = $s.data.status
    Write-Host ("[{0,3}s] {1}" -f ($i*15), $status)
    if ($status -in 'SUCCEEDED','FAILED','ABORTED','TIMED-OUT') { break }
}
"final status: $status"
"defaultDataset: $($s.data.defaultDatasetId)"
"stats: $($s.data.stats | ConvertTo-Json -Compress)"
if ($status -eq 'SUCCEEDED') {
    # persist dataset for scoring
    $items = Invoke-RestMethod -Uri "$base/datasets/$($s.data.defaultDatasetId)/items?clean=true&token=$t"
    $items | ConvertTo-Json -Depth 8 | Set-Content -Path 'spike\platform-phaseA-dataset.json' -Encoding UTF8
    "dataset rows: $(($items | Measure-Object).Count) -> spike\platform-phaseA-dataset.json"
}
