export default {                                                              
    async fetch(request) {
      const url = new URL(request.url);
      const target = 'http://ibi.zju.edu.cn/PlantscRNAdb_v4/api' +              
  url.pathname.replace('/proxy', '');                                           
                                                                                
      const body = await request.text();                                        
      const res = await fetch(target, {
        method: request.method,
        headers: {                                                              
          'Content-Type': 'application/json',
          'Accept': 'application/json',                                         
          'Origin': 'http://ibi.zju.edu.cn',
          'Referer': 'http://ibi.zju.edu.cn/plantscrnadb/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },                                                                      
        body: body || undefined,                                                
      });                                                                       
   
      const data = await res.text();                                            
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',                 
          'Access-Control-Allow-Headers': 'Content-Type',
        },                                                                      
      });  
    },                                                                          
  };       

