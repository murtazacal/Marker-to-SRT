(function(){
 var $=function(id){return document.getElementById(id);};
 var btn=$('export'),status=$('status'),sequenceSelect=$('sequence'),styleSelect=$('style');
 function callHost(script,done){
  if(!window.__adobe_cep__){done(null,'CEP bridge unavailable. Open this panel inside Premiere Pro.');return;}
  window.__adobe_cep__.evalScript(script,function(result){done(result,null);});
 }
 function refreshSequences(keepValue){
  var old=keepValue?sequenceSelect.value:null;
  sequenceSelect.innerHTML='';
  var loading=document.createElement('option');loading.value='';loading.textContent='Loading sequences…';sequenceSelect.appendChild(loading);
  callHost('MarkerToSRT.listSequences()',function(result,error){
   if(error){status.textContent=error;return;}
   try{
    var data=JSON.parse(result);
    if(!data.ok)throw new Error(data.message||'Unable to read project sequences.');
    sequenceSelect.innerHTML='';
    if(!data.sequences.length){var none=document.createElement('option');none.value='';none.textContent='No sequences in project';sequenceSelect.appendChild(none);status.textContent='No sequences found in the open project.';return;}
    data.sequences.forEach(function(seq){
     var opt=document.createElement('option');opt.value=String(seq.index);opt.textContent=seq.name+(seq.active?' (Active)':'');
     if(seq.active)opt.selected=true;
     sequenceSelect.appendChild(opt);
    });
    if(old!==null){for(var i=0;i<sequenceSelect.options.length;i++){if(sequenceSelect.options[i].value===old){sequenceSelect.value=old;break;}}}
    status.textContent='Found '+data.sequences.length+' sequence(s).';
   }catch(e){status.textContent='Could not read sequences: '+e.message+'\n'+result;}
  });
 }
 $('refresh').onclick=function(){refreshSequences(true);};

 function refreshStyles(keepValue){
  var old=keepValue?styleSelect.value:null;
  styleSelect.innerHTML='';
  var loading=document.createElement('option');loading.value='';loading.textContent='Scanning local styles…';styleSelect.appendChild(loading);
  callHost('MarkerToSRT.listStyles()',function(result,error){
   if(error){styleSelect.innerHTML='<option value="">Unable to scan styles</option>';status.textContent=error;return;}
   try{
    var data=JSON.parse(result);
    if(!data.ok)throw new Error(data.message||'Unable to scan local styles.');
    styleSelect.innerHTML='';
    if(!data.folderExists){var missing=document.createElement('option');missing.value='';missing.textContent='Style folder not found';styleSelect.appendChild(missing);return;}
    if(!data.styles.length){var none=document.createElement('option');none.value='';none.textContent='No .prtextstyle files found';styleSelect.appendChild(none);return;}
    data.styles.forEach(function(style){
     var opt=document.createElement('option');opt.value=style.path;opt.textContent=style.name;styleSelect.appendChild(opt);
    });
    if(old!==null){for(var i=0;i<styleSelect.options.length;i++){if(styleSelect.options[i].value===old){styleSelect.value=old;break;}}}
   }catch(e){styleSelect.innerHTML='<option value="">Could not read styles</option>';status.textContent='Style scan failed: '+e.message+'\\n'+result;}
  });
 }
 $('refreshStyles').onclick=function(){refreshStyles(true);};
 $('importStyle').onclick=function(){
  if(!styleSelect.value){status.textContent='Select a local .prtextstyle file first.';return;}
  var importButton=$('importStyle');importButton.disabled=true;status.textContent='Importing selected style into the open project…';
  var arg=JSON.stringify(JSON.stringify({path:styleSelect.value}));
  callHost('MarkerToSRT.importStyle('+arg+')',function(result,error){
   importButton.disabled=false;
   if(error){status.textContent=error;return;}
   try{var obj=JSON.parse(result);status.textContent=(obj.ok?'✓ ':'⚠ ')+obj.message+(obj.path?'\\n'+obj.path:'');}
   catch(e){status.textContent='Premiere returned an error: '+result;}
  });
 };

 btn.onclick=function(){
  if(!window.__adobe_cep__){status.textContent='CEP bridge unavailable. Open this panel inside Premiere Pro.';return;}
  if(sequenceSelect.value===''){status.textContent='Select a target sequence first.';return;}
  var duration=parseFloat($('duration').value);
  if(!isFinite(duration)||duration<=0||duration>120){status.textContent='Duration must be between 0.1 and 120 seconds.';return;}
  var opts={sequenceIndex:parseInt(sequenceSelect.value,10),source:$('source').value,duration:duration,filename:$('filename').value,importToSequence:$('import').checked,skipEmpty:$('skip').checked};
  btn.disabled=true;status.textContent='Exporting captions from selected sequence…';
  var arg=JSON.stringify(JSON.stringify(opts));
  callHost('MarkerToSRT.exportSRT('+arg+')',function(result,error){
   btn.disabled=false;
   if(error){status.textContent=error;return;}
   try{var obj=JSON.parse(result);status.textContent=(obj.ok?'✓ ':'⚠ ')+obj.message+(obj.path?'\n'+obj.path:'');}
   catch(e){status.textContent='Premiere returned an error: '+result;}
  });
 };
 refreshSequences(false);
 refreshStyles(false);
})();