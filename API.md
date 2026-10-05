# Video Upscale API

Base URL: `http://localhost:6008`

All APIs use:

- Method: `POST`
- Header: `Content-Type: application/json`
- Body: JSON

## Status Values

| status | stage | meaning |
|---|---|---|
| `1` | `processing` | DB entry created, video is generating in background |
| `2` | `completed` | `outputUrl` is ready |
| `3` | `failed` | check `errorMessage` |

`videoUrl` in responses is the original user-provided source URL. `outputUrl` is updated later from the Higgsfield status response.

## Models

| model | resolutions | notes |
|---|---|---|
| `bytedance` | `1080p`, `2k`, `4k`, `8k` | primary upscale model |
| `flux3` | `1080p`, `2k`, `4k` | may return `model_not_found` if not enabled on the Higgsfield API key |
| `topaz` | `1080p`, `2k`, `4k`, `2160p` | alternate upscale model |

Optional settings:

| field | values | default |
|---|---|---|
| `creativityMode` | `subtle`, `bold` | `subtle` |
| `frameInterpolation` | `true`, `false` | `false` |

## 1. Start Upscale

`POST /api/upscale`

Request:

```json
{
  "userId": 1,
  "videoUrl": "https://example.com/clip.mp4",
  "model": "bytedance",
  "resolution": "4k",
  "creativityMode": "subtle",
  "frameInterpolation": false
}
```

Required fields:

| field | required | validation |
|---|---|---|
| `userId` | yes | positive integer |
| `videoUrl` | yes | must start with `https://` |
| `model` | yes | `bytedance`, `flux3`, `topaz` |
| `resolution` | yes | must be supported by selected model |

Success `202`:

```json
{
  "success": true,
  "id": 15,
  "requestId": "hf-request-id",
  "videoUrl": "https://example.com/clip.mp4",
  "creativityMode": "subtle",
  "frameInterpolation": false,
  "outputUrl": null,
  "status": 1,
  "stage": "processing"
}
```

What happens after success:

- Row is inserted into `explainerVideo`.
- `sourceUrl` stores the input `videoUrl`.
- `outputUrl` is initially `NULL`.
- Backend polls Higgsfield in background.
- On success, same row updates to `status = 2`, `stage = completed`, and `outputUrl = Higgsfield generated URL`.
- On failure, same row updates to `status = 3`, `stage = failed`, and `errorMessage`.

Common errors:

```json
{ "success": false, "message": "userId is required in JSON body" }
```

```json
{ "success": false, "message": "videoUrl must be an https URL" }
```

```json
{ "success": false, "message": "model must be bytedance, flux3, or topaz" }
```

```json
{ "success": false, "message": "creativityMode must be subtle or bold" }
```

## 2. Fetch Videos

`POST /api/videos`

Fetch all non-deleted videos:

```json
{}
```

Fetch one user's videos:

```json
{
  "userId": 1
}
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
      "outputUrl": null,
      "model": "bytedance",
      "resolution": "4k",
      "requestId": "hf-request-id",
      "errorMessage": null,
      "creativityMode": "subtle",
      "frameInterpolation": false,
      "stage": "processing",
      "status": 1,
      "created": "2026-10-05T10:30:00.000Z",
      "modified": "2026-10-05T10:30:00.000Z"
    }
  ]
}
```

## 3. Fetch One Video

`POST /api/videos/get`

Request:

```json
{
  "id": 15
}
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
    "outputUrl": "https://higgsfield-output-url.example/video.mp4",
    "model": "bytedance",
    "resolution": "4k",
    "requestId": "hf-request-id",
    "errorMessage": null,
    "creativityMode": "subtle",
    "frameInterpolation": false,
    "stage": "completed",
    "status": 2,
    "created": "2026-10-05T10:30:00.000Z",
    "modified": "2026-10-05T10:35:00.000Z"
  }
}
```

Errors:

```json
{ "success": false, "message": "id is required in JSON body" }
```

```json
{ "success": false, "message": "Video not found" }
```

## 4. Delete Video

`POST /api/videos/delete`

Request:

```json
{
  "id": 15
}
```

Success `200`:

```json
{
  "success": true,
  "id": 15
}
```

This soft deletes the row by setting `isDeleted = 1`. Deleted rows do not appear in fetch APIs.

Errors:

```json
{ "success": false, "message": "id is required in JSON body" }
```

```json
{ "success": false, "message": "Video not found" }
```
