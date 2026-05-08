$repoPath = "D:\TZ\work\autojs-checkin-tool"
$lastCommit = Get-Date

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $repoPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Filter for code files only
$watcher.Filter = "*.*"
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    $changeType = $Event.SourceEventArgs.ChangeType

    # Skip .git directory and node_modules
    if ($path -match '\\\.git\\' -or $path -match '\\node_modules\\') { return }
    # Skip temp/backup files
    if ($name.EndsWith('.tmp') -or $name.EndsWith('.bak')) { return }

    $now = Get-Date
    $elapsed = $now - $script:lastCommit
    # Debounce: only commit if at least 2 minutes since last commit
    if ($elapsed.TotalSeconds -lt 120) { return }

    Start-Sleep -Seconds 5  # Wait for file write to complete

    Set-Location $repoPath
    git add -A
    $status = git status --porcelain
    if ($status) {
        $msg = "auto: $($name) changed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m $msg
        git push origin master 2>&1 | Out-Null
        $script:lastCommit = Get-Date
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Auto-committed: $name"
    }
}

Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null

Write-Host "Auto-commit watcher started. Watching: $repoPath"
Write-Host "Press Ctrl+C to stop."

try {
    while ($true) { Start-Sleep -Seconds 60 }
} finally {
    $watcher.Dispose()
}
