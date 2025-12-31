//wip, don't have a reason to really make this work for now :p

let aiContext = [];
async function handleThreadMessages(thread, message) {
  let curThread = aiContext.findIndex(obj => obj.thread === thread); //gives us the thread index :3
  console.log(curThread);

  if (curThread !== -1) {
    aiContext[curThread].messages.push(message);
    console.log(aiContext[curThread].messages);
  } else {
    aiContext.push({ thread, messages: [message] });
    curThread = aiContext.findIndex(obj => obj.thread === thread); //this should exist now :3
  }

  //ping endpoint for our awesome ai shit :3
  let aiResponse = await fetch(`http://127.0.0.1:3232/v1/chat/completions`, { //should be perfectly fine, since we're using localhost here
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: aiContext[curThread].messages }),
  });
  aiResponse = await aiResponse.json();

  aiContext[curThread].messages.push(aiResponse.choices[0].message);
  return thread.send(aiResponse.choices[0].message.content);
} 