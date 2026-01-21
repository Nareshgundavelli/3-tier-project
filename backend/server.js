// SAVE
if (req.method === 'POST' && parsed.pathname === '/api/save') {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      console.log('RAW BODY:', body);

      const data = JSON.parse(body);
      console.log('PARSED DATA:', data);

      const name = data.name;
      const age = Number(data.age);
      const className = data.className;
      const roll = Number(data.roll);
      const place = data.place;

      if (!name || !className || !place || isNaN(age) || isNaN(roll)) {
        throw new Error('Invalid payload');
      }

      await db.query(
        `INSERT INTO students (name, age, class_name, roll, place)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (name)
         DO UPDATE SET age=$2, class_name=$3, roll=$4, place=$5`,
        [name, age, className, roll, place]
      );

      res.writeHead(200);
      res.end('saved');
    } catch (err) {
      console.error('INSERT FAILED >>>', err.message);
      res.writeHead(500);
      res.end('error');
    }
  });
  return;
}
