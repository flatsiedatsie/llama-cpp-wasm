import { action } from "./actions.js";

class LlamaCpp {
    // callback have to be defined before load_worker
    constructor(url, init_callback, write_result_callback, on_complete_callback, message_callback) {
        this.url = url;
        this.init_callback = init_callback;
        this.write_result_callback = write_result_callback;
        this.on_complete_callback = on_complete_callback;
		this.message_callback = message_callback;
        this.loadWorker();
    }
    
    loadWorker() {
        this.worker = new Worker(
            new URL("./main-worker.js", import.meta.url),
            {type: "module"}
        );
        
        this.worker.onmessage = (event) => {
			console.log("received message from worker: ", event, event.data.event);
			console.log("window.settings.assistant: ", window.settings.assistant);
            switch (event.data.event) {
				
				case action.MESSAGE:
					console.log("got generic message from worker: ", event.data);
                	// GENERIC MESSAGE FROM WORKER
					
                	if (this.message_callback) {
						console.log("calling message_callback with: event.data ");
						if(event.data.progression){
							console.log("got data about download / load progress: ", event.data.progression);
							console.log(" downloading assistant: ", window.settings.assistant);
							this.message_callback(event.data.progression);
						}
                    	else{
                    		//console.error("missing event.data.progression");
                    	}
                	}
					
                	break;
				
                case action.INITIALIZED:
                    // Load Model
                    if (this.init_callback) {
                        this.init_callback();
                    }

                    break;
                case action.WRITE_RESULT:
                    // Capture result
                    if (this.write_result_callback) {
                        this.write_result_callback(event.data.text);
                    }

                    break;
                case action.RUN_COMPLETED:
                    // Execution Completed
                    if (this.on_complete_callback) {
                        this.on_complete_callback();
                    }
                    
                    break;
            }
        };

        this.worker.postMessage({
            event: action.LOAD,
            url: this.url,
        });
    }

    run({
        prompt,
        chatml=false,
        n_predict=-2,
        ctx_size=2048,
        batch_size=512,
        temp=0.8,
        n_gpu_layers=0,
        top_k=40,
        top_p=0.9,
        no_display_prompt=true,
    }={}) {
        this.worker.postMessage({
            event: action.RUN_MAIN,
            prompt,
            chatml,
            n_predict,
            ctx_size,
            batch_size,
            temp,
            n_gpu_layers,
            top_k,
            top_p,
            no_display_prompt,
        });
    }
}

export { LlamaCpp };