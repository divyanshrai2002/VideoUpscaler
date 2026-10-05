# Video Upscale API

Base URL: `http://localhost:6008`

Har request:

- Method: `POST`
- Header: `Content-Type: application/json`
- Body: JSON only.

## Status

| status | stage | matlab |
|---|---|---|
| 1 | `processing` | entry ban gayi hai, video background me generate ho raha hai |
| 2 | `completed` | `outputUrl` ready hai |
| 3 | `failed` | `errorMessage` dekho |

`/api/upscale` request aate hi DB me entry banata hai with `status = 1`. Backend background me video status check karta hai. Complete hone par same row me `outputUrl`, `status = 2`, `stage = completed` update hota hai. Error aane par `status = 3`, `stage = failed`, `errorMessage` update hota hai.

## 1. Upscale Video

`POST /api/upscale`

```json
{
  "userId": 1,
  "videoUrl": "https://example.com/clip.mp4",
  "model": "bytedance",
  "resolution": "4k",
  "creativityMode": "subtle",
  "frameInterpolation": true
}
```

| field | required | values |
|---|---|---|
| `userId` | yes | positive integer |
| `videoUrl` | yes | public `https` URL |
| `model` | yes | `bytedance`, `flux3`, `topaz` |
| `resolution` | yes | model ke hisaab se |
| `creativityMode` | no | `subtle` (default) ya `bold` |
| `frameInterpolation` | no | `true` ya `false`, default `false` |

Resolutions:

- `bytedance`: `1080p`, `2k`, `4k`, `8k`
- `flux3`: `1080p`, `2k`, `4k`
- `topaz`: `1080p`, `2k`, `4k`, `2160p`

Success `202`:

```json
{
  "success": true,
  "id": 15,
  "requestId": "uuid",
  "videoUrl": "https://example.com/clip.mp4",
  "creativityMode": "subtle",
  "frameInterpolation": true,
  "outputUrl": null,
  "status": 1,
  "stage": "processing"
}
```

Error `400` / `500`:

```json
{ "success": false, "message": "videoUrl must be an https URL" }
```

## 2. Fetch One Video

`POST /api/videos/get`

```json
{ "id": 15 }
```

Success `200`:

```json
{
  "success": true,
  "video": {
    "id": 15,
    "userId": 1,
    "name": "Video Upscale",
    "videoUrl": "https://example.com/clip.mp4",
    "outputUrl": null,
    "model": "bytedance",
    "resolution": "4k",
    "requestId": "uuid",
    "errorMessage": null,
    "stage": "processing",
    "status": 1,
    "created": "2026-10-05T10:30:00.000Z",
    "modified": "2026-10-05T10:30:00.000Z"
  }
}
```

Jab complete ho jaye:

- `status`: `2`
- `stage`: `completed`
- `outputUrl`: generated video URL

Jab fail ho jaye:

- `status`: `3`
- `stage`: `failed`
- `errorMessage`: failure reason

## 3. Fetch Videos

`POST /api/videos`

Saari videos:

```json
{}
```

Ek user ki videos:

```json
{ "userId": 1 }
```

## 4. Delete Video

`POST /api/videos/delete`

```json
{ "id": 15 }
```

Success `200`:

```json
{ "success": true, "id": 15 }
```
