$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$indexPath = Join-Path $projectRoot 'index.html'
$faviconPath = Join-Path $projectRoot 'assets\favicon.svg'
$indexHtml = Get-Content -Raw $indexPath
$failures = [System.Collections.Generic.List[string]]::new()

$iconLinks = [regex]::Matches(
    $indexHtml,
    '<link\s+rel="(?:icon|shortcut icon)"\s+href="assets/favicon\.svg\?v=brand-15"\s+type="image/svg\+xml">',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

if ($iconLinks.Count -ne 2) {
    $failures.Add('The page does not expose the approved SVG through both favicon link relations')
}

if (-not (Test-Path -LiteralPath $faviconPath)) {
    $failures.Add('assets/favicon.svg is missing')
}
else {
    $favicon = Get-Content -Raw $faviconPath
    if ($favicon -notmatch '<svg[^>]+width="16"[^>]+height="16"[^>]+viewBox="0 0 16 16"') {
        $failures.Add('The favicon is not the supplied 16x16 SVG')
    }
    if ($favicon -notmatch '#53052C' -or $favicon -notmatch '#D6B36A') {
        $failures.Add('The favicon does not contain the supplied burgundy and gold artwork')
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'Favicon checks passed.'
