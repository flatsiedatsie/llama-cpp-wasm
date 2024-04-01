import { action } from "./actions.js";
const cacheName = "llama-cpp-wasm-cache";

export async function loadBinaryResource(url, callback) {
    let cache = null, window = self;

    // Try to find if the model data is cached in Web Worker memory.
    if (typeof window === "undefined") {
        console.debug("`window` is not defined");
    } else if (window && window.caches) {
        cache = await window.caches.open(cacheName);
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
            const data = await cachedResponse.arrayBuffer();
            const byteArray = new Uint8Array(data);
            callback(byteArray);
            return;
        }
    }
	
	/*
    function async fetchWithCache(url) {
      const request = new Request(url);
      if (this.cache === undefined) {
        this.cache = await caches.open(cacheName);
      }
      let result = await this.cache.match(request);
      if (result === undefined) {
        await this.cache.add(request);
        result = await this.cache.match(request);
      }
      if (result === undefined) {
        throw Error("Cannot fetch " + url);
      }
      return result;
    }
	*/


	function updateProgress(evt) {
		try{
			console.log("evt.loaded: ", evt.loaded);
			//console.log("evt.total: ", evt.total);
		
	 	    if (evt.lengthComputable) {
				var percentComplete = (evt.loaded / evt.total) * 100;
				console.log("percentComplete: ", Math.floor(percentComplete));
				
				//update_download_progress(evt.loaded / evt.total);
				
		        postMessage({
		            'event': action.MESSAGE,
					'action': 'download_progress',
					'progression': (evt.loaded / evt.total),
		        });
				
			} 
		}
		catch(e){
			console.error("utility.js: updateProgress error: ", e);
		}
	}   

    // Download model and store in cache
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
	req.onprogress = updateProgress;
	
    req.onload = async (_) => {
        const arrayBuffer = req.response; // Note: not req.responseText
        
        if (arrayBuffer) {
            const byteArray = new Uint8Array(arrayBuffer);
            
            if (cache) {
                await cache.put(url, new Response(arrayBuffer))
            };

            callback(byteArray);
        }
    };

    req.send(null);
}
