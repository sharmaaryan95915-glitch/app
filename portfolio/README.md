# Video Editing Portfolio

A professional dark portfolio website for video editors. You upload videos from a private admin panel. Clients see a clean portfolio, and you can send them a single video link or a personal link with videos you picked for them.

## Run it

```bash
cd portfolio
npm install
ADMIN_PASSWORD=your-secret-password npm start
```

- Portfolio: http://localhost:3000
- Admin panel: http://localhost:3000/admin (default password `admin123`; set `ADMIN_PASSWORD` to change it)

## Features

| Page | URL | What it does |
|---|---|---|
| Portfolio | `/` | Hero, showreel, filterable video grid, services, about, contact |
| Admin | `/admin` | Drag and drop video upload with a progress bar, thumbnails, feature/hide/delete, profile and showreel settings |
| Single video | `/v/<id>` | A clean page to share one video with a client |
| Client link | `/c/<id>` | A personal page for one client: your message, the videos you picked, optional download, and a view counter |

Use the **Client links** tab in the admin panel to create a link, then copy it or send it on WhatsApp in one click. The tab shows how many times the client opened the link and when they last opened it.

## Settings (environment variables)

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | Server port |
| `ADMIN_PASSWORD` | `admin123` | Admin login password, **change this** |
| `SESSION_SECRET` | derived from password | Signs the login cookie |
| `MAX_UPLOAD_MB` | `1024` | Maximum upload size |

## Where the data lives

- Videos and thumbnails: `uploads/`
- Database: `data/db.json` (a simple JSON file)

Both folders are git-ignored. When you deploy, host it somewhere with **persistent disk** (a VPS, Render with a disk, Railway with a volume, etc.) so your uploads are kept.

---

## हिंदी में

1. `npm install` चलाएँ, फिर `ADMIN_PASSWORD=आपका-पासवर्ड npm start` चलाएँ।
2. `/admin` पर लॉग इन करें और वीडियो अपलोड करें। Title, Category और Client भरें।
3. "Your profile" में अपना नाम, ईमेल, WhatsApp नंबर और showreel सेट करें।
4. क्लाइंट को भेजने के लिए **Client links** टैब में जाएँ, वीडियो चुनें और लिंक बनाएँ। फिर लिंक कॉपी करें या WhatsApp बटन से सीधे भेज दें।
5. किसी एक वीडियो का लिंक भेजना हो तो उस वीडियो पर **Copy link** दबाएँ।
