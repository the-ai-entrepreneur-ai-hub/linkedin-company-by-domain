. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN

$me = Invoke-RestMethod -Uri "$base/users/me?token=$t"
"users/me: username=$($me.data.username) plan=$($me.data.plan.id)"

$mine = Invoke-RestMethod -Uri "$base/acts?limit=200&token=$t&my=own"
"total own acts: $($mine.data.total)"
$mine.data.items | Where-Object { $_.createdAt -gt (Get-Date).AddDays(-1) } | ForEach-Object {
    "recent24h: id=$($_.id) name=$($_.name) user=$($_.username) public=$($_.isPublic) created=$($_.createdAt)"
}

try {
    $a = Invoke-RestMethod -Uri "$base/acts/0reNPvdycTAAOpOYQ?token=$t"
    "BY-ID OK now: $($a.data.username)/$($a.data.name) public=$($a.data.isPublic)"
} catch { "BY-ID still failing: $($_.ErrorDetails.Message)" }
