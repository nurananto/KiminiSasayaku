/**
 * ENCRYPT-MANIFEST.JS - IMPROVED DETECTION VERSION
 * 🔐 Encrypts manifest.json files with AES-256
 * ✅ Better detection: checks UNENCRYPTED manifests first
 * ✅ Fallback to git diff if needed
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============================================
// ENCRYPTION SETTINGS
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const FORCE_SCAN_ALL = process.env.FORCE_SCAN_ALL === 'true';

// ✅ SECURITY: Token must be provided via environment variable
if (!SECRET_TOKEN) {
    console.error('╔═══════════════════════════════════════╗');
    console.error('║  ❌ SECURITY ERROR                    ║');
    console.error('╚═══════════════════════════════════════╝\n');
    console.error('SECRET_TOKEN environment variable is required!');
    console.error('\nPlease set MANIFEST_SECRET_TOKEN in GitHub Secrets:');
    console.error('  Repository → Settings → Secrets → Actions');
    console.error('\nTo generate a secure token:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"');
    process.exit(1);
}

// Derive key from token (32 bytes for AES-256)
function deriveKey(token) {
    return crypto.createHash('sha256').update(token).digest();
}

// ============================================
// ENCRYPTION FUNCTIONS
// ============================================

function encryptText(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (IV needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
}

function isEncrypted(text) {
    // Check if text matches encrypted pattern (hex:hex)
    return /^[0-9a-f]{32}:[0-9a-f]+$/i.test(text);
}

// ============================================
// IMPROVED: GET ALL MANIFESTS
// ============================================

function getAllManifestsInRepo() {
    try {
        const output = execSync('find . -name "manifest.json" -not -path "./.git/*"', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        if (output) {
            const allManifests = output.split('\n')
                .map(path => path.replace('./', ''))
                .filter(path => fs.existsSync(path));
            
            return allManifests;
        }
    } catch (error) {
        console.error('❌ Error finding manifests:', error.message);
    }
    return [];
}

// ============================================
// 🔥 NEW: PRIORITY CHECK UNENCRYPTED MANIFESTS
// ============================================

function getUnencryptedManifests() {
    const allManifests = getAllManifestsInRepo();
    const unencryptedManifests = [];
    
    console.log(`📋 Scanning ${allManifests.length} total manifest(s)...`);
    
    for (const manifestPath of allManifests) {
        try {
            const content = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(content);
            
            if (manifest.pages && manifest.pages.length > 0) {
                const firstPage = manifest.pages[0];
                if (!isEncrypted(firstPage)) {
                    unencryptedManifests.push(manifestPath);
                    console.log(`   🔓 Unencrypted: ${manifestPath}`);
                }
            }
        } catch (error) {
            console.warn(`   ⚠️  Invalid manifest: ${manifestPath}`);
        }
    }
    
    return unencryptedManifests;
}

// ============================================
// IMPROVED: GIT DETECTION (FALLBACK)
// ============================================

function getModifiedManifestsFromGit() {
    try {
        let manifestFiles = [];
        
        // Strategy 1: Check last commit
        try {
            const lastCommitFiles = execSync('git diff --name-only HEAD~1 HEAD', { 
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            }).trim();
            
            if (lastCommitFiles) {
                const changedFiles = lastCommitFiles.split('\n');
                console.log(`📋 Changed files in last commit: ${changedFiles.length}`);
                
                manifestFiles = changedFiles.filter(file => {
                    return file.endsWith('manifest.json') && 
                           !file.startsWith('.') && 
                           fs.existsSync(file);
                });
                
                if (manifestFiles.length > 0) {
                    console.log(`📝 Manifest files in last commit: ${manifestFiles.length}`);
                    manifestFiles.forEach(f => console.log(`   - ${f}`));
                }
            }
        } catch (diffError) {
            console.log('ℹ️  Could not diff last commit (might be first commit)');
        }
        
        // Strategy 2: Check unstaged changes
        if (manifestFiles.length === 0) {
            try {
                const unstagedFiles = execSync('git diff --name-only', {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe']
                }).trim();
                
                if (unstagedFiles) {
                    const files = unstagedFiles.split('\n');
                    const unstagedManifests = files.filter(file => {
                        return file.endsWith('manifest.json') && 
                               !file.startsWith('.') && 
                               fs.existsSync(file);
                    });
                    
                    if (unstagedManifests.length > 0) {
                        console.log(`📝 Found ${unstagedManifests.length} unstaged manifest(s)`);
                        manifestFiles = [...manifestFiles, ...unstagedManifests];
                    }
                }
            } catch (error) {
                // Silent fail
            }
        }
        
        // Strategy 3: Check untracked files
        try {
            const untrackedFiles = execSync('git ls-files --others --exclude-standard', {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            }).trim();
            
            if (untrackedFiles) {
                const files = untrackedFiles.split('\n');
                const untrackedManifests = files.filter(file => {
                    return file.endsWith('manifest.json') && 
                           !file.startsWith('.') && 
                           fs.existsSync(file);
                });
                
                if (untrackedManifests.length > 0) {
                    console.log(`📝 Found ${untrackedManifests.length} untracked manifest(s)`);
                    manifestFiles = [...manifestFiles, ...untrackedManifests];
                }
            }
        } catch (error) {
            // Silent fail
        }
        
        // Remove duplicates
        return [...new Set(manifestFiles)];
        
    } catch (error) {
        console.warn('⚠️  Error detecting git changes:', error.message);
        return [];
    }
}

// ============================================
// 🔥 NEW: SMART MANIFEST DETECTION
// ============================================

function getManifestsToEncrypt() {
    // 🔥 FORCE MODE: Return all manifests
    if (FORCE_SCAN_ALL) {
        console.log('🔥 Force mode enabled - will scan ALL manifests\n');
        const allManifests = getAllManifestsInRepo();
        console.log(`📋 Found ${allManifests.length} total manifest(s) in repo`);
        return allManifests;
    }
    
    // ============================================
    // PRIORITY 1: Check for unencrypted manifests first
    // This catches newly uploaded manifests regardless of git history
    // ============================================
    console.log('🔍 Priority check: Looking for unencrypted manifests...\n');
    const unencryptedManifests = getUnencryptedManifests();
    
    if (unencryptedManifests.length > 0) {
        console.log(`\n✅ Found ${unencryptedManifests.length} unencrypted manifest(s)!`);
        return unencryptedManifests;
    }
    
    console.log('\n✅ All manifests are encrypted');
    
    // ============================================
    // PRIORITY 2: Fallback to git detection
    // Only if no unencrypted manifests found
    // ============================================
    console.log('\n🔍 Checking git for recent changes...\n');
    const gitManifests = getModifiedManifestsFromGit();
    
    if (gitManifests.length > 0) {
        console.log(`\n📝 Found ${gitManifests.length} manifest(s) from git changes`);
        return gitManifests;
    }
    
    console.log('\nℹ️  No manifest changes detected');
    return [];
}

// ============================================
// MANIFEST PROCESSING
// ============================================

function encryptManifest(filePath, secretKey) {
    try {
        console.log(`\n🔍 Processing: ${filePath}`);
        
        // Read manifest
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const manifest = JSON.parse(fileContent);
        
        if (!manifest.pages || !Array.isArray(manifest.pages)) {
            console.log(`  ⚠️  No pages array found - skipping`);
            return false;
        }
        
        // Check if already encrypted
        const firstPage = manifest.pages[0] || '';
        if (isEncrypted(firstPage)) {
            console.log(`  ✅ Already encrypted - skipping`);
            return false;
        }
        
        const isTiling = manifest.tiling === true;
        console.log(`  📊 Total pages: ${manifest.pages.length}${isTiling ? ' (tiling enabled)' : ''}`);
        console.log(`  🔐 Encrypting...`);
        
        // Encrypt each page URL
        manifest.pages = manifest.pages.map(pageUrl => {
            return encryptText(pageUrl, secretKey);
        });
        
        // Encrypt grids and orders if tiling manifest
        if (isTiling && Array.isArray(manifest.grids) && Array.isArray(manifest.orders)) {
            manifest.grids = manifest.grids.map(grid => {
                return encryptText(JSON.stringify(grid), secretKey);
            });
            manifest.orders = manifest.orders.map(order => {
                return encryptText(JSON.stringify(order), secretKey);
            });
            console.log(`  🧩 Encrypted ${manifest.grids.length} grids + orders`);
        }
        
        // Add encryption marker
        manifest.encrypted = true;
        manifest.encryption_version = isTiling ? '2.0' : '1.0';
        
        // Save encrypted manifest
        const jsonString = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(filePath, jsonString, 'utf8');
        
        console.log(`  ✅ Encrypted successfully!`);
        return true;
        
    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

// ============================================
// MAIN
// ============================================

function main() {
    const modeText = FORCE_SCAN_ALL ? '🔥 FORCE MODE: Scan ALL manifests' : '🔍 Smart detection mode';
    
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   MANIFEST ENCRYPTION SCRIPT v4.0     ║');
    console.log(`║ ${modeText.padEnd(39)}║`);
    console.log('╚═══════════════════════════════════════╝\n');
    
    // Derive encryption key
    const secretKey = deriveKey(SECRET_TOKEN);
    console.log(`🔑 Secret token loaded (${SECRET_TOKEN.length} chars)\n`);
    
    // Get manifests to encrypt using smart detection
    const manifestsToProcess = getManifestsToEncrypt();
    
    if (manifestsToProcess.length === 0) {
        console.log('\n✅ No new manifests to encrypt');
        process.exit(0);
    }
    
    console.log(`\n📋 Will process ${manifestsToProcess.length} manifest(s):`);
    manifestsToProcess.forEach(file => console.log(`   - ${file}`));
    
    // Encrypt each manifest
    let encryptedCount = 0;
    
    manifestsToProcess.forEach(filePath => {
        if (encryptManifest(filePath, secretKey)) {
            encryptedCount++;
        }
    });
    
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║  ✅ Encryption completed!             ║`);
    console.log(`║  📊 Encrypted: ${encryptedCount}/${manifestsToProcess.length} manifest(s)${' '.repeat(11 - String(encryptedCount).length - String(manifestsToProcess.length).length)}║`);
    console.log(`╚═══════════════════════════════════════╝`);
}

main();