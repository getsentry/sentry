import HookStore from 'app/stores/hookStore';

export default function analytics(name, data) {
  HookStore.get('analytics:event').forEach(cb => cb(name, data));
}
