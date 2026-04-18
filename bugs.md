# Postboy - Bug Tracker

## P0: Critical - Core Functionality Broken

### Bug 1: Body Editor Forces Key-Value Structure
**Files:** `src/ui/app/ui.tsx:110`, `src/ui/app/components/keyvaluefield.tsx`
**Status:** Open

The request body is edited using `KeyValueField`, which treats the body as key-value pairs (like headers). This is fundamentally wrong:
- HTTP bodies can be raw JSON, XML, form-data, plain text, binary, etc.
- `parseJsonToPairs()` (`keyvaluefield.tsx:135`) only works for JSON objects — JSON arrays like `["a", "b"]` fail silently and return `[]`
- `pairsToJson()` (`keyvaluefield.tsx:144`) always produces an object, so you can never send an array body

**Impact:** Users cannot send array bodies, raw text, XML, or any non-object body format.

### Bug 2: Double JSON Serialization in handleSend
**Files:** `src/ui/app/ui.tsx:154`, `src/ui/app/ui.tsx:161`
**Status:** Open

```typescript
if (currentRequest.body) parsedBody = JSON.parse(currentRequest.body);  // line 154
const reqBody = parsedBody ? JSON.stringify(parsedBody) : undefined;    // line 161
```

The body is parsed as JSON then re-stringified:
- Any non-JSON body (plain text, form-urlencoded) triggers a parse error and the request is never sent
- Even valid JSON gets unnecessarily round-tripped

**Impact:** Only JSON object/array bodies work. Plain text, XML, form-data bodies all fail with "Invalid JSON" error.

---

## P1: High - Major UX / Functionality Issues

### Bug 3: No Cursor Position in Text Input Dialogs
**Files:** 
- `src/ui/app/components/Formfield.tsx:55-60`
- `src/ui/app/components/keyvaluefield.tsx:57-88`
- `src/ui/app/components/exportdialog.tsx:71-77`
**Status:** Open

All custom text input dialogs lack cursor position tracking:
- Backspace/delete **always** removes the last character
- Typing **always** appends to the end
- No left/right arrow navigation within text

**Impact:** Users cannot edit the middle of URLs, headers, or body values. They must delete everything and retype.

### Bug 4: No URL Validation Before Sending
**Files:** `src/utils/request.ts:31`, `src/ui/app/ui.tsx:144-182`
**Status:** Open

```typescript
const urlObj = new URL(url);  // request.ts:31
```

If the URL is empty or malformed, `new URL()` throws. The `handleSend` function in `ui.tsx` does not validate the URL before calling `sendRequest()`. The error is caught by the generic catch block but gives a confusing error message.

**Impact:** Empty URL crashes with a cryptic error instead of a user-friendly "URL is required" message.

---

## P2: Medium - Interoperability / Platform Issues

### Bug 5: Missing Content-Length and Content-Type Headers
**File:** `src/utils/request.ts:43-49`
**Status:** Open

```typescript
const options: http.RequestOptions = {
  method,
  hostname: urlObj.hostname,
  port: urlObj.port || (isHttps ? 443 : 80),
  path: urlObj.pathname + urlObj.search,
  headers,
};
```

When a body is sent:
- `Content-Length` is never explicitly set
- `Content-Type` is never auto-set (e.g., `application/json` for JSON bodies)

**Impact:** Some servers will reject requests without proper `Content-Length` or `Content-Type` headers.

### Bug 10: Export Dialog `HOME` Environment Variable May Be Undefined
**File:** `src/ui/app/components/exportdialog.tsx:15`
**Status:** Open

```typescript
const EXPORT_DIR = `${process.env.HOME}/.postboy/exports`;
```

`process.env.HOME` can be `undefined` on some systems (e.g., Windows, or when HOME is not set). This would produce `undefined/.postboy/exports` as the path.

**Impact:** Export to file crashes on platforms where `HOME` is not set.

---

## P3: Low - Minor / Edge Cases

### Bug 6: History Type Mismatch on Reload
**File:** `src/ui/app/ui.tsx:195-196`
**Status:** Open

```typescript
headers: typeof item.headers === 'object' ? JSON.stringify(item.headers, null, 2) : item.headers || '',
body: typeof item.body === 'object' ? JSON.stringify(item.body, null, 2) : item.body || ''
```

The `HistoryEntry` type (`history.ts:7`) stores `headers` and `body` as `Record<string, string> | string` and `string | Record<string, any>`. But `HistoryManager.addEntry()` spreads the `RequestConfig` which has `headers` as a **string** (the JSON string from the UI). The `typeof === 'object'` check will never match for stored history entries, making this dead code. The type mismatch between what's stored (string) and what the type declares indicates a deeper design inconsistency.

**Impact:** Potential data corruption on reload; dead code path.

### Bug 7: Response Headers Display Can Crash
**File:** `src/ui/app/components/responsepanel.tsx:115`
**Status:** Open

```typescript
{Object.entries(JSON.parse(response.headers || '{}')).map(([key, value]) => (
```

If `response.headers` contains invalid JSON (which could happen if error paths set unexpected values), this will throw an uncaught error and crash the response panel.

**Impact:** Response panel can crash when viewing headers tab.

### Bug 8: HTTP Methods Limited in Type but UI Supports More
**Files:** `src/types/index.ts:8`, `src/ui/app/ui.tsx:93`
**Status:** Open

The `RequestConfig` type only allows `'GET' | 'POST' | 'PUT' | 'DELETE'`, but the UI's `HTTP_METHODS` array includes `PATCH`, `OPTIONS`, `HEAD`. Sending a `PATCH` request will work at runtime but violates TypeScript types.

**Impact:** TypeScript compilation errors; runtime works fine.

### Bug 9: History List Uses Unstable React Key
**File:** `src/ui/app/components/historylist.tsx:129`
**Status:** Open

```typescript
key={item.timestamp}
```

Using `timestamp` as a React key is unstable — two requests made in the same millisecond would collide, causing React reconciliation issues.

**Impact:** Rare rendering glitches in history list.
