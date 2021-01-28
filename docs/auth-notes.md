# how authentication works.

    First the user logs in using waxjs (it shows a popup and logs the user in).

    This gives us the user id client side, but the user can easily change it in javascript.

    What we need is some way for the server to say prove you are account X by putting this token on the blockchain. However the blockchain is public, so there needs to be a way to prove they put the token on the blockchain.

    1. server creates nonce.

    2. server creates noncehash (sha256 hash of nonce).

    3. server tells client 'put hash of nonce on blockchain'

    4. client puts noncehash on blockchain.

    5. server sees noncehash on blockchain under user.

    Any attacker knows noncehash and user id, but not nonce, so attacker cannot impersonate user.
