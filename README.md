# Kimi ni Sasayaku

> Bagaimana jika suatu hari, suara Streamer ASMR yang seharusnya hanya kamu dengar lewat earphone, tiba-tiba terdengar tepat di samping telingamu— Apakah ini adalah sebuah ‘halusinasi’? Ataukah suaranya itu benar-benar nyata?

---

## Info

| | |
|---|---|
| Judul | Kimi ni Sasayaku |
| Judul Alternatif | 君に囁く |
| Author | Megurumiru |
| Tipe | Manga (Hitam Putih) |
| Status | Tamat (Chapter Oneshot) |
| Genre | Shounen · Comedy · Romance · School Life · Slice of Life |
| Chapter | 1 chapter |

## Link

- [Raw](https://comic-walker.com/detail/KC_008254_S/episodes/KC_0082540000200011_E?episodeType=latest)

---

## Struktur

```
KiminiSasayaku/
├── manga-config.json     # Metadata manga
├── manga.json            # Data chapter (auto-generated)
├── manga-automation.js   # Script automation
├── encrypt-manifest.js   # Script enkripsi manifest
├── daily-views.json      # Data views harian
└── <chapter>/
    └── manifest.json     # Daftar halaman (encrypted)
```

## Automation

Semua proses berjalan otomatis via GitHub Actions:

1. Push chapter baru (folder + manifest.json)
2. `encrypt-manifest.yml` — enkripsi manifest
3. `manga-automation.yml` — regenerate manga.json
4. Trigger rebuild ke website utama
5. `sync-cover.yml` — sinkronisasi cover dari website

---

Bagian dari [Nurananto Scanlation](https://nuranantoscans.my.id)