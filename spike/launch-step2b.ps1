. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$H = @{ 'X-API-Token' = $env:APIFY_TOKEN }

# try slug form
try {
    $a = Invoke-RestMethod -Uri "$base/acts/george.the.developer~linkedin-company-by-domain" -Headers $H
    "SLUG OK -> id=$($a.data.id) isPublic=$($a.data.isPublic) username=$($a.data.username)"
} catch { "SLUG FAIL: $($_.Exception.Message)" }

# search own actors
$mine = Invoke-RestMethod -Uri "$base/acts?limit=100&offset=0&my=own" -Headers $H
$hit = $mine.data.items | Where-Object { $_.name -like '*company*domain*' }
if ($hit) {
    foreach ($h in $hit) { "FOUND: id=$($h.id) name=$($h.name) username=$($h.username) isPublic=$($h.isPublic) created=$($h.createdAt)" }
} else {
    "not in first page; total=$($mine.data.total)"
    $mine.data.items | Where-Object { $_.createdAt -gt (Get-Date).AddHours(-2) } | ForEach-Object { "recent: $($_.id) $($_.name) $($_.createdAt)" }
}
