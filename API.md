# Video Upscale API

Base URL: `http://localhost:6008`

Har request:

- Method: `POST`
- Header: `Content-Type: application/json`
- Body: JSON only. URL params ya form-data mat bhejna.

Upscale turant video return nahi karta. Pehle job create hoti hai (`status: 1`). Backend Higgsfield ko poll karta hai. Frontend ko `POST /api/videos/get` se status check karte rehna hai jab tak `status` `2` (done) ya `3` (failed) na ho.

## Status

| status | stage | matlab |
|---|---|---|
| 1 | `processing` | upscale chal raha hai, `outputUrl` abhi `null` |
| 2 | `completed` | `outputUrl` ready hai |
| 3 | `failed` | `errorMessage` dekho |

## 1. Start upscale

`POST /api/upscale`

```json
{
  "userId": 1,
  "videoUrl": "https://example.com/clip.mp4",
  "model": "bytedance",
  "resolution": "4k"
}
```

| field | required | values |
|---|---|---|
| `userId` | yes | positive integer |
| `videoUrl` | yes | public `https` URL |
| `model` | yes | `bytedance`, `flux3`, `topaz` |
| `resolution` | yes | model ke hisaab se, neeche |

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
  "status": 1,
  "stage": "processing"
}
```

`id` save karo. Polling isi `id` se hogi. `outputUrl` is response mein nahi aata.

Error `400` / `500`:

```json
{ "success": false, "message": "videoUrl must be an https URL" }
```

## 2. Poll one video

`POST /api/videos/get`

Har 4 second pe call karo, jab tak `status` `2` ya `3` na ho.

```json
{ "id": 15 }
```

Success `200` while processing:

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

Jab complete ho:

- `status` = `2`
- `stage` = `completed`
- `outputUrl` = upscaled video URL (preview aur download isi se)

Jab fail ho:

- `status` = `3`
- `stage` = `failed`
- `errorMessage` = reason
- `outputUrl` = `null`

Not found `404`:

```json
{ "success": false, "message": "Video not found" }
```

Missing id `400`:

```json
{ "success": false, "message": "id is required in JSON body" }
```

Frontend loop:

1. `POST /api/upscale` se `id` lo.
2. `POST /api/videos/get` with `{ "id" }`.
3. `status === 1` ho to 4s baad dubara call karo.
4. `status === 2` ho to `outputUrl` dikhao.
5. `status === 3` ho to `errorMessage` dikhao aur poll band karo.

## 3. List videos

`POST /api/videos`

Saari videos:

```json
{}
```

Ek user ki videos:

```json
{ "userId": 1 }
```

Success `200`:

```json
{
  "success": true,
  "videos": [
    {
      "id": 15,
      "userId": 1,
      "name": "Video Upscale",
      "videoUrl": "https://example.com/clip.mp4",
      "outputUrl": "https://cdn.example.com/upscaled.mp4",
      "model": "bytedance",
      "resolution": "4k",
      "requestId": "uuid",
      "errorMessage": null,
      "stage": "completed",
      "status": 2,
      "created": "2026-10-05T10:30:00.000Z",
      "modified": "2026-10-05T10:35:00.000Z"
    }
  ]
}
```

Deleted rows is list mein nahi aati.

## 4. Delete video

`POST /api/videos/delete`

```json
{ "id": 15 }
```

Success `200`:

```json
{ "success": true, "id": 15 }
```

Row hide ho jati hai (`isDeleted`). Dobara get ya list mein nahi aayegi. Galat id pe `404`.
