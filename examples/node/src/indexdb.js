import "fake-indexeddb/auto";

import IndexDB from "@pluto-encrypted/indexdb";
import SDK from "@atala/prism-wallet-sdk";


// TODO: move DID to env
// https://sit-prism-mediator.atalaprism.io/ - NOTE: currently returning a 504
// const mediatorDIDString = 'did:peer:2.Ez6LSghwSE437wnDE1pt3X6hVDUQzSjsHzinpX3XFvMjRAm7y.Vz6Mkhh1e5CEYYq6JBUcTZ6Cp2ranCWRrv7Yax3Le4N59R6dd.SeyJ0IjoiZG0iLCJzIjp7InVyaSI6Imh0dHBzOi8vc2l0LXByaXNtLW1lZGlhdG9yLmF0YWxhcHJpc20uaW8iLCJhIjpbImRpZGNvbW0vdjIiXX19.SeyJ0IjoiZG0iLCJzIjp7InVyaSI6IndzczovL3NpdC1wcmlzbS1tZWRpYXRvci5hdGFsYXByaXNtLmlvL3dzIiwiYSI6WyJkaWRjb21tL3YyIl19fQ'

// local mediator did
const mediatorDIDString = 'did:peer:2.Ez6LSghwSE437wnDE1pt3X6hVDUQzSjsHzinpX3XFvMjRAm7y.Vz6Mkhh1e5CEYYq6JBUcTZ6Cp2ranCWRrv7Yax3Le4N59R6dd.SeyJ0IjoiZG0iLCJzIjp7InVyaSI6Imh0dHBzOi8vc2FuZGJveC1tZWRpYXRvci5hdGFsYXByaXNtLmlvIiwiYSI6WyJkaWRjb21tL3YyIl19fQ.SeyJ0IjoiZG0iLCJzIjp7InVyaSI6IndzczovL3NhbmRib3gtbWVkaWF0b3IuYXRhbGFwcmlzbS5pby93cyIsImEiOlsiZGlkY29tbS92MiJdfX0'

async function createAgent () {
  const mediatorDID = SDK.Domain.DID.fromString(mediatorDIDString)

  const store = new SDK.Store({
    name: 'test',
    storage: IndexDB,
    password: Buffer.from("demoapp").toString("hex")
  })

  const apollo = new SDK.Apollo()
  const seed = apollo.createRandomSeed();

  const pluto = new SDK.Pluto(
    store,
    apollo
  )

  return {
    agent: SDK.Agent.initialize({ mediatorDID, pluto, apollo, seed: seed.seed }),
    seed
  }
}

(async () => {

  // create the SDK agent
  const {
    seed,
    agent
  } = await createAgent()
    .catch(err => console.error('Failed to create the agent', err))
  console.log('Agent created')

  // start the SDK agent
  await agent.start()
    .catch(err => console.error('Failed to start the agent', err))

  console.log('Agent started and mediation has been established')


  // listen for new messages
  agent.addListener(SDK.ListenerKey.MESSAGE, async (message) => {
    console.log("Got new message", message);

    // await agent.stop()
    //   .then(() => console.log('Agent stopped'))
  });
  
  console.log()
  console.log(
    `Welcome to PrismEdge Agent, state ${agent.state
    } with mnemonics ${seed.mnemonics.join(", ")}`,
  )
  console.log()


  // Send a message
  try {
    console.log('Creating test message')
    const secondaryDID = await agent.createNewPeerDID([], true);
    const message = new SDK.BasicMessage(
      { content: "Test Message" },
      secondaryDID,
      secondaryDID,
    );

    await agent.sendMessage(message.makeMessage());
    await agent.sendMessage(message.makeMessage());

    console.log('Test message sent!')
  } catch (err) {
    if (/Malformed: Message is not a valid JWE, JWS or JWM/.test(err.message)) {
      // NOTE: Safe to ignore, mediator returns null on successfully receiving the message, unpack fails.
      console.log('Test message sent!')
    } else {
      throw err
    }
  }
})();





