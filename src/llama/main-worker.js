import { action } from "./actions.js";
import { loadBinaryResource } from "./utility.js";
import Module from "./main.js";

// WASM Module
let module;

// hard-coded filepath for loaded model in vfs
const model_path = "/models/model.bin";

// Function to send model line result
const print = (text) => {
    postMessage({
        event: action.WRITE_RESULT,
        text: text,
    });
};

/*
const update_download_progress = (progression) => {
    postMessage({
        event: action.MESSAGE,
        progression: progression,
    });
};
*/

// Function to initialize worker 
// and download model file
const decoder = new TextDecoder('utf-8');
const punctuationBytes = [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 58, 59, 60, 61, 62, 63, 64, 91, 92, 93, 94, 95, 96, 123, 124, 125, 126];
const whitespaceBytes = [32, 9, 10, 13, 11, 12];
const splitBytes = [...punctuationBytes, ...whitespaceBytes];
const stdoutBuffer = [];

const stdin  = () => {};

const stdout = (c) => {
    stdoutBuffer.push(c);

    if (splitBytes.indexOf(c) == -1) {
        return;
    }

    const text = decoder.decode(new Uint8Array(stdoutBuffer));
    stdoutBuffer.splice(0, stdoutBuffer.length);
    print(text);
};

const stderr = () => {};

const initWorker = async (modelPath) => {
    const emscrModule = {
        noInitialRun: true,
        preInit: [() => {
            emscrModule.TTY.register(emscrModule.FS.makedev(5, 0), {
                get_char: tty => stdin(tty),
                put_char: (tty, val) => { tty.output.push(val); stdout(val); },
                flush: tty => tty.output = [],
                fsync: tty => console.log("fsynced stdout (EmscriptenRunnable does nothing in this case)")
            });

            emscrModule.TTY.register(emscrModule.FS.makedev(6, 0), {
                get_char: tty => stdin(tty),
                put_char: (tty, val) => { tty.output.push(val); stderr(val); },
                flush: tty => tty.output = [],
                fsync: tty => console.log("fsynced stderr (EmscriptenRunnable does nothing in this case)")
            });
        }],
    };

    module = await Module(emscrModule);

    const initCallback = (bytes) => {
        // create vfs folder for storing model bins
        module['FS_createPath']("/", "models", true, true);

        // load model
        module['FS_createDataFile']('/models', 'model.bin', bytes, true, true, true);
        
        // update callback action to worker main thread
        postMessage({
            event: action.INITIALIZED
        });
    }

    loadBinaryResource(modelPath, initCallback);
}

const run_main = (
    prompt,
    chatml,
    n_predict,
    ctx_size,
    batch_size,
    temp,
    n_gpu_layers,
    top_k,
    top_p,
    no_display_prompt
) => {
    const args = [
        "--model", model_path,
        "--n-predict", n_predict.toString(),
        "--ctx-size", ctx_size.toString(),
        "--temp", temp.toString(),
        "--top_k", top_k.toString(),
        "--top_p", top_p.toString(),
        // "--no-mmap",
        "--simple-io",
        "--log-disable",
        "--prompt", prompt.toString(),
    ];

    if (!!globalThis.SharedArrayBuffer) {
        args.push("--threads");
        args.push((navigator.hardwareConcurrency / 2).toString());
    }

    if (chatml) {
        args.push("--chatml");
    }

    if (no_display_prompt) {
        args.push("--no-display-prompt");
    }

    module['callMain'](args);

    postMessage({
        event: action.RUN_COMPLETED
    });
} 

// Worker Events
self.addEventListener('message', (e) => {
	console.log("llama-mt/main-worker: message:  e.data: ", e.data)
    switch (e.data.event) {
        case action.LOAD:
            // load event
            initWorker(e.data.url);
            break;
        case action.RUN_MAIN:
            // run main
            run_main(
                e.data.prompt,
                e.data.chatml,
                e.data.n_predict,
                e.data.ctx_size,
                e.data.batch_size,
                e.data.temp,
                e.data.n_gpu_layers,
                e.data.top_k,
                e.data.top_p,
                e.data.no_display_prompt,
            );

            break;
    }
}, false);


self.addEventListener("install", (e) => {
	console.error("EVENT LISTENER INSTALL SOMETHING");
  e.waitUntil(
    caches
      .open("llama-cpp-wasm-cache")
      .then((cache) =>
        cache.addAll([
		  "https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b/resolve/main/stablelm-2-zephyr-1_6b-Q5_K_M.gguf",
		  //"https://huggingface.co/TheBloke/TowerInstruct-7B-v0.1-GGUF/resolve/main/towerinstruct-7b-v0.1.Q2_K.gguf",
        ]),
      ),
  );
});


/*
	

          "./index.html",
          "./hopsa.js",
		  "./llama-mt/actions.js",
		  "./llama-mt/llama.js",
		  "./llama-mt/main-worker.js",
		  "./llama-mt/main.js",
		  "./llama-mt/main.wasm",
		  "./llama-mt/main.worker.mjs",
		  "./llama-mt/utility.js",
          "./css/pico.min.css",
	
*/

/*
self.addEventListener("fetch", (e) => {
  console.log("worker caught fetch: ", e.request.url);
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
*/

const CACHE_VERSION = 1;
const CURRENT_CACHES = {
  font: `student_ai-v${CACHE_VERSION}`,
};

self.addEventListener("activate", (event) => {
	console.log("in activate");
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic
  // will handle the case where there are multiple versioned caches.
  const expectedCacheNamesSet = new Set(Object.values(CURRENT_CACHES));
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!expectedCacheNamesSet.has(cacheName)) {
            // If this cache name isn't present in the set of
            // "expected" cache names, then delete it.
            console.log("Deleting out of date cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  console.log("Handling fetch event for", event.request.url);

  event.respondWith(
    caches.open(CURRENT_CACHES.font).then((cache) => {
      return cache
        .match(event.request)
        .then((response) => {
          if (response) {
            // If there is an entry in the cache for event.request,
            // then response will be defined and we can just return it.
            // Note that in this example, only font resources are cached.
            console.log(" Found response in cache:", response);

            return response;
          }

          // Otherwise, if there is no entry in the cache for event.request,
          // response will be undefined, and we need to fetch() the resource.
          console.log(
            " No response for %s found in cache. About to fetch " +
              "from network…",
            event.request.url,
          );

          // We call .clone() on the request since we might use it
          // in a call to cache.put() later on.
          // Both fetch() and cache.put() "consume" the request,
          // so we need to make a copy.
          // (see https://developer.mozilla.org/en-US/docs/Web/API/Request/clone)
          return fetch(event.request.clone()).then((response) => {
            console.log(
              "  Response for %s from network is: %O",
              event.request.url,
              response,
            );

            if (
              response.status < 400 //&&
              //response.headers.has("content-type") &&
              //response.headers.get("content-type").match(/^font\//i)
            ) {
              // This avoids caching responses that we know are errors
              // (i.e. HTTP status code of 4xx or 5xx).
              // We also only want to cache responses that correspond
              // to fonts, i.e. have a Content-Type response header that
              // starts with "font/".
              // Note that for opaque filtered responses
              // https://fetch.spec.whatwg.org/#concept-filtered-response-opaque
              // we can't access to the response headers, so this check will
              // always fail and the font won't be cached.
              // All of the Google Web Fonts are served from a domain that
              // supports CORS, so that isn't an issue here.
              // It is something to keep in mind if you're attempting
              // to cache other resources from a cross-origin
              // domain that doesn't support CORS, though!
              console.log("  Caching the response to", event.request.url);
              // We call .clone() on the response to save a copy of it
              // to the cache. By doing so, we get to keep the original
              // response object which we will return back to the controlled
              // page.
              // https://developer.mozilla.org/en-US/docs/Web/API/Request/clone
              cache.put(event.request, response.clone());
            } else {
              console.log("  Not caching the response to", event.request.url);
            }

            // Return the original response object, which will be used to
            // fulfill the resource request.
            return response;
          });
        })
        .catch((error) => {
          // This catch() will handle exceptions that arise from the match()
          // or fetch() operations.
          // Note that a HTTP error response (e.g. 404) will NOT trigger
          // an exception.
          // It will return a normal response object that has the appropriate
          // error code set.
          console.error("  Error in fetch handler:", error);

          throw error;
        });
    }),
  );
});


