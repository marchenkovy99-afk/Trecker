const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('sync.js', 'utf8');
function run(initial) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  vm.runInNewContext(source, { localStorage, document: { createElement: () => ({}), head: { append() {} } }, console });
  return values;
}
const old = {lawyerCloudSession:'old-session', lawyerTasks:'[{"id":"keep"}]', lawyerCloudDirty:'{"lawyerTasks":"pending"}'};
const migrated = run(old);
assert.equal(migrated.get('lawyerCloudSession'), undefined, 'do not send old-project credentials to the new project');
assert.equal(migrated.get('lawyerTasks'), old.lawyerTasks);
assert.equal(migrated.get('lawyerCloudDirty'), old.lawyerCloudDirty);
assert.equal(migrated.get('lawyerCloudProject'), 'qwnkigorqsgugcctnfmj');
const again = run(Object.fromEntries([...migrated, ['lawyerCloudSession', 'new-session']]));
assert.equal(again.get('lawyerCloudSession'), 'new-session', 'reload preserves new-project login');
console.log('cloud project migration tests passed');
