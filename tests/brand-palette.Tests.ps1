$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$productionFiles = @(
    Join-Path $repoRoot 'index.html'
    Join-Path $repoRoot 'preview.css'
    Join-Path $repoRoot 'preview.js'
) + @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'assets') -File -Recurse |
    Where-Object { $_.Extension -in '.css', '.svg' } |
    ForEach-Object { $_.FullName })

$oldColours = '#5D0323', '#E2B167', '#F2E6D1'
$failures = [System.Collections.Generic.List[string]]::new()

foreach ($file in $productionFiles) {
    $content = Get-Content -Raw -LiteralPath $file
    foreach ($colour in $oldColours) {
        if ($content -match [regex]::Escape($colour)) {
            $failures.Add("Deprecated colour $colour remains in $file")
        }
    }
}

$html = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'index.html')
$previewCss = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'preview.css')
$previewJs = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'preview.js')
$logo = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'assets/novat-brand-logo.svg')

if ($html -match 'id="(?:design|background)-toggle"') {
    $failures.Add('A design/background toggle is still rendered in index.html')
}
if ($previewJs -match 'previewDesign|previewBackground|design-toggle|background-toggle') {
    $failures.Add('Toggle behaviour remains in preview.js')
}
if ($previewCss -notmatch 'html, body, \.aside-part\s*\{\s*background-color:\s*#FFFFFF') {
    $failures.Add('The page and sidebar are not fixed to a white background')
}

$cssRules = @{}
$cssForRules = $previewCss -replace '(?s)/\*.*?\*/', ''
foreach ($match in [regex]::Matches($cssForRules, '(?s)([^{}]+)\{([^{}]*)\}')) {
    foreach ($selector in $match.Groups[1].Value.Split(',')) {
        $selectorName = $selector.Trim()
        $cssRules[$selectorName] = [string]$cssRules[$selectorName] + "`n" + $match.Groups[2].Value
    }
}
$burgundySelectors = @(
    '.archive-wrapper .month-season--prev .choose-type'
    '.archive-wrapper .month-season--prev .choose-type:hover'
    '.data .number-day'
    '.data .number-day .info-item'
    '.data .number-day__month'
    '.data .day-week'
    '.data .info-item--right'
    '.poster-item__info .info-item'
)
foreach ($selector in $burgundySelectors) {
    if (-not $cssRules.ContainsKey($selector) -or $cssRules[$selector] -notmatch 'color:\s*var\(--brand-burgundy\)') {
        $failures.Add("$selector is not fixed to the approved burgundy")
    }
}

if ($logo -notmatch '#e2b267' -or $logo -match '#e2b167') {
    $failures.Add('The logo does not exclusively use the approved yellow #E2B267')
}

$combinedProduction = ($productionFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_ }) -join "`n"
if ($combinedProduction -notmatch '#53052C') {
    $failures.Add('Approved burgundy #53052C is absent from production assets')
}
if ($combinedProduction -notmatch '#E2B267') {
    $failures.Add('Approved yellow #E2B267 is absent from production assets')
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    exit 1
}

Write-Output 'Final brand palette and single-variant checks passed.'
