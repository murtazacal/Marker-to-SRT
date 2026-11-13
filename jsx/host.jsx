/* Marker to SRT — CEP ExtendScript backend, ES3 compatible */
var MarkerToSRT = MarkerToSRT || {};
MarkerToSRT.quote = function(s) {return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');};
MarkerToSRT.json = function(ok,message,path){return '{"ok":'+(ok?'true':'false')+',"message":"'+MarkerToSRT.quote(message)+'","path":"'+MarkerToSRT.quote(path||'')+'"}';};
MarkerToSRT.time = function(seconds){
 var ms=Math.max(0,Math.round(seconds*1000)),h=Math.floor(ms/3600000);ms%=3600000;
 var m=Math.floor(ms/60000);ms%=60000;var s=Math.floor(ms/1000);ms%=1000;
 function pad(n,l){var x=String(n);while(x.length<l)x='0'+x;return x;}
 return pad(h,2)+':'+pad(m,2)+':'+pad(s,2)+','+pad(ms,3);
};
MarkerToSRT.clean = function(s){return String(s||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/^\s+|\s+$/g,'');};

MarkerToSRT.listSequences = function(){
 try {
  if(!app.project)return MarkerToSRT.json(false,'No project is open.');
  var coll=app.project.sequences, n=coll.numSequences, active=app.project.activeSequence;
  var rows=[];
  for(var i=0;i<n;i++){
   /* Premiere SequenceCollection is zero-based. Prefer getSequenceAt()
      when exposed by the host, then fall back to zero-based indexing. */
   var seq=null;
   try { if(typeof coll.getSequenceAt==='function') seq=coll.getSequenceAt(i); } catch(getErr) {}
   if(!seq){try { seq=coll[i]; } catch(indexErr) {}}
   if(!seq)continue;
   var isActive=false;
   try { isActive=(active && seq.sequenceID===active.sequenceID); } catch(e) {}
   if(!isActive){try { isActive=(active && seq.name===active.name); } catch(e2) {}}
   rows.push('{"index":'+i+',"name":"'+MarkerToSRT.quote(seq.name||('Sequence '+(i+1)))+'","active":'+(isActive?'true':'false')+'}');
  }
  return '{"ok":true,"sequences":['+rows.join(',')+']}';
 } catch(err){return '{"ok":false,"message":"'+MarkerToSRT.quote(err.toString())+'","sequences":[]}';}
};


/* Style support added without changing the tested marker export/import routine. */
MarkerToSRT.listStyles = function(){
 try {
  var dir=Folder(Folder.myDocuments.fsName+'/Adobe/Common/Assets/Text Styles');
  if(!dir.exists)return '{"ok":true,"folderExists":false,"styles":[]}';
  var files=dir.getFiles(function(f){return f instanceof File && /\.prtextstyle$/i.test(f.name);});
  files.sort(function(a,b){var x=a.name.toLowerCase(),y=b.name.toLowerCase();return x<y?-1:(x>y?1:0);});
  var rows=[];
  for(var i=0;i<files.length;i++){
   rows.push('{"name":"'+MarkerToSRT.quote(files[i].name.replace(/\.prtextstyle$/i,''))+'","path":"'+MarkerToSRT.quote(files[i].fsName)+'"}');
  }
  return '{"ok":true,"folderExists":true,"styles":['+rows.join(',')+']}';
 } catch(err){return '{"ok":false,"message":"'+MarkerToSRT.quote(err.toString())+'","styles":[]}';}
};

MarkerToSRT.importStyle = function(payload){
 try {
  var o=eval('(' + payload + ')'),path=String(o.path||'');
  if(!app.project)return MarkerToSRT.json(false,'No Premiere project is open.');
  if(!path)return MarkerToSRT.json(false,'Select a text style first.');
  var file=File(path);
  if(!file.exists)return MarkerToSRT.json(false,'Selected style file no longer exists: '+path,path);
  if(!/\.prtextstyle$/i.test(file.name))return MarkerToSRT.json(false,'The selected file is not a .prtextstyle file.',path);
  var imported=app.project.importFiles([file.fsName],true,app.project.rootItem,false);
  if(imported){
   return MarkerToSRT.json(true,'Imported "'+file.name+'" into the open project. Select your captions and apply the style manually in Premiere’s Text/Properties panel.',file.fsName);
  }
  return MarkerToSRT.json(false,'Premiere did not confirm the style import. Check the Project panel.',file.fsName);
 } catch(err){return MarkerToSRT.json(false,'Style import failed: '+err.toString());}
};

MarkerToSRT.exportSRT = function(payload){
 try {
  var o=eval('(' + payload + ')'),seq=null,seqIndex=Number(o.sequenceIndex);
  if(!app.project)return MarkerToSRT.json(false,'No project is open.');
  if(isFinite(seqIndex) && seqIndex>=0 && Math.floor(seqIndex)===seqIndex){
   try {
    var sequenceCollection=app.project.sequences;
    if(typeof sequenceCollection.getSequenceAt==='function') seq=sequenceCollection.getSequenceAt(seqIndex);
    if(!seq) seq=sequenceCollection[seqIndex];
   } catch(seqErr){seq=null;}
  }
  if(!seq)seq=app.project.activeSequence;
  if(!seq)return MarkerToSRT.json(false,'No sequence is available. Open a sequence first.');
  var coll=seq.markers;
  if(!coll||!coll.numMarkers)return MarkerToSRT.json(false,'The active sequence has no sequence markers. Clip markers are not included.');
  var markers=[],m=coll.getFirstMarker(),guard=0;
  while(m&&guard++<100000){
   var name=MarkerToSRT.clean(m.name),comments=MarkerToSRT.clean(m.comments),txt='';
   if(o.source==='name')txt=name||comments;
   else if(o.source==='both')txt=(name&&comments)?name+'\n'+comments:(name||comments);
   else txt=comments||name;
   var start=Number(m.start.seconds),end=Number(m.end.seconds);
   if(isFinite(start)&&start>=0)markers.push({start:start,end:end,text:txt});
   m=coll.getNextMarker(m);
  }
  markers.sort(function(a,b){return a.start-b.start;});
  var lines=[],count=0,duration=Number(o.duration)||3;
  /* Preserve exact marker boundaries. If marker B starts exactly when marker A ends,
     both SRT cues use that same boundary. Do not offset by a frame: overlapping cues
     can be merged by Premiere during SRT import. */
  for(var i=0;i<markers.length;i++){
   var item=markers[i];if(o.skipEmpty&&!item.text)continue;
   var start=item.start,end=item.end;
   if(!(end>item.start+0.001)){ end=item.start+duration; }
   if(end<=start+0.001)continue;
   count++;lines.push(String(count)+'\r\n'+MarkerToSRT.time(start)+' --> '+MarkerToSRT.time(end)+'\r\n'+item.text+'\r\n');
  }
  if(!count)return MarkerToSRT.json(false,'No usable caption markers found.');
  var base=MarkerToSRT.clean(o.filename||seq.name||'captions').replace(/[\\\/:*?"<>|]/g,'_').replace(/\.srt$/i,'');
  if(!base)base='captions';
  var dest=File.saveDialog('Save '+base+'.srt','SRT captions:*.srt');
  if(!dest)return MarkerToSRT.json(false,'Export cancelled.');
  if(!/\.srt$/i.test(dest.name))dest=File(dest.fsName+'.srt');
  dest.encoding='UTF-8';dest.lineFeed='Windows';
  if(!dest.open('w'))return MarkerToSRT.json(false,'Unable to open destination for writing.');
  dest.write('\uFEFF'+lines.join('\r\n'));dest.close();
  var msg='Exported '+count+' captions from sequence “'+seq.name+'” using exact marker start/end boundaries. Consecutive markers share the same boundary without overlap. Point markers used the '+duration+'s fallback.';
  if(o.importToSequence){
   try{
    var imported=app.project.importFiles([dest.fsName],true,app.project.rootItem,false);
    if(!imported){msg+=' SRT saved, but Premiere did not import it.';}
    else {
     var found=null,root=app.project.rootItem;
     function search(bin){for(var k=0;k<bin.children.numItems;k++){var p=bin.children[k];try{if(p.getMediaPath&&p.getMediaPath()===dest.fsName)return p;}catch(e){}if(p.type===2){var q=search(p);if(q)return q;}}return null;}
     found=search(root);
     if(!found){msg+=' SRT imported, but the new project item could not be located; add the caption track manually.';}
     else if(typeof seq.createCaptionTrack!=='function'){msg+=' SRT imported into Project panel. This Premiere version does not expose createCaptionTrack() to ExtendScript; add captions manually.';}
     else {
      var created;
      /* Explicitly request Premiere's native Subtitle caption format.
         This matches the format used when an imported .srt is dropped onto a sequence.
         Passing the enum avoids relying on host-version default format inference. */
      if(typeof Sequence !== 'undefined' && typeof Sequence.CAPTION_FORMAT_SUBTITLE !== 'undefined'){
       created=seq.createCaptionTrack(found,0,Sequence.CAPTION_FORMAT_SUBTITLE);
      } else {
       created=seq.createCaptionTrack(found,0);
      }
      if(created){msg+=' Imported SRT as a native Subtitle caption track in sequence “'+seq.name+'”.';}
      else{msg+=' SRT imported, but Premiere rejected native Subtitle caption-track creation.';}
     }
    }
   }catch(impErr){msg+=' SRT saved, but automatic import/track creation failed: '+impErr.toString();}
  }
  return MarkerToSRT.json(true,msg,dest.fsName);
 }catch(err){return MarkerToSRT.json(false,err.toString());}
};
