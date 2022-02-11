 // (c) FBV, ver 1.0
 let CONFIG = {
  inputId: 0,
  switchId: 0,
  faseTemps: [ 60, 900, 900, 300 ],
  fase: 0, // Fase activa
  swIsOn: false,
  swOnTime: 0, // Temps quan es posa a on
  segsFase0: 60, // Temps per reinicialtzat a Fase 1
  swOffTime: 0, // Temps quan es posa a off
  segsRetoc: 300, // Repulsació sense canvi de Fase
  faseExt: false, // Senyalització d'avis
  myTimer: null,
};

Shelly.call("Switch.SetConfig", {
  id: CONFIG.switchId,
  config: {
    in_mode: "detached",
  },
});

Shelly.addEventHandler(function (event) {
  // print("D", event.name, event.id, JSON.stringify(event) );
  
  if (event.name === "input" && event.id === CONFIG.inputId) {
    //print("DI", event.name, event.id, JSON.stringify(event) );
    if (typeof event.info.event === "undefined") return;
    //ignore single_push and double_push events
    //if (event.info.event.indexOf("push") >= 0) return;
    if (event.info.event === "single_push") {
      let swParams = {
        id: CONFIG.switchId
      };
      if ( CONFIG.swIsOn ) {
        // Sempre que pulsem i està engegat, apaguem.
        swParams.on = false;
        CONFIG.faseExt = false;
        CONFIG.swIsOn = false;
      } else {
        CONFIG.swIsOn = true;
        if ( event.now - CONFIG.swOffTime > CONFIG.segsFase0 ) {
          // Sala freda, tornem a Fase 0.
          CONFIG.fase = 0;
          print("DI Switch ", "Set Fase 0" );
        }
        
        if (CONFIG.fase === 0 ) {
          CONFIG.fase = 1;
          CONFIG.swOnTime = event.now;
          CONFIG.faseExt = true;
        } else {
          let secsRemain = event.now - CONFIG.swOnTime;
          if ( secsRemain < CONFIG.segsRetoc ) {
            CONFIG.swOnTime = event.now;
            print("DI Switch ", "Repensado en Fase", CONFIG.fase);
          } else {
            if (CONFIG.fase === 1 ) {
              CONFIG.fase = 2;
              CONFIG.swOnTime = event.now;
              CONFIG.faseExt = true;
            } else if (CONFIG.fase === 2 ) {
              CONFIG.fase = 3;
              CONFIG.faseExt = false;
            } 
          }
        }
        print("DI Switch ", "Set Fase ", CONFIG.fase);
        swParams.toggle_after = CONFIG.faseTemps[CONFIG.fase];
        swParams.on = true;
      }
      Shelly.call("Switch.Set", swParams);
      print("DI Switch ", event.id, "is", swParams.on? "On" : "Off", CONFIG.faseTemps[CONFIG.fase], "seg, fase:", CONFIG.fase );
    }
  } else {
    if (event.name === "switch" && event.id === CONFIG.switchId) {
      //print("DS", event.name, event.id, JSON.stringify(event) );
      if (typeof event.info.output === "undefined") return;
      CONFIG.swIsOn = event.info.output;
      if (event.info.output) {
        print("EH Switch ", event.id, " is on at", CONFIG.swOnTime);
      } else {
        if (CONFIG.faseExt === true) {
          CONFIG.faseExt = false;
          let swParams = {
            id: CONFIG.switchId,
            toggle_after: CONFIG.faseTemps[0],
            on: true,
          };
          if (CONFIG.myTimer !== null ) {
            Timer.clear(CONFIG.myTimer);
            CONFIG.myTimer = null;
          }
          CONFIG.myTimer = Timer.set(CONFIG.fase === 1 ? 600: 1200, false
          , function (ud) {
            Shelly.call("Switch.Set", ud, function (result, code, msg, ud) {}, null);  
          }, swParams );
        } else {
          CONFIG.swOffTime = event.now;
        }
        print("EH Switch ", event.id, " is off at", CONFIG.swOffTime);
      }
    }
  }
});
