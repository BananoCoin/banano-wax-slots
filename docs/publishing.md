## to check for outdated deps

## to check file size of db

    du -hs * | sort -hr

## to update to a major version update:

    npm install package@latest;

## to publish a new version

    npm run preflight;

    git commit -a -m 'updating dependencies';
    npm version patch;
    git pull;
    git push;
    git push --tags;