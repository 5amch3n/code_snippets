// open a terminal, and type something simillar to this
node -e "h=require('crypto').createHash(process.argv[1]);fs.createReadStream(process.argv[2]).on('data',(chunk)=>h.update(chunk)).on('end',()=>console.log(h.digest('hex').toUpperCase()))" sha512 ~/Downloads/iPhone7,2_9.3.5_13G36_Restore.ipsw 
