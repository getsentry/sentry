import {policyUrlSchema} from 'admin/components/policies/policyFormModal';

describe('policy URL validation', () => {
  it.each(['', 'https://example.com/policy/', 'http://example.com/policy/'])(
    'accepts %s',
    value => {
      expect(policyUrlSchema.safeParse(value).success).toBe(true);
    }
  );

  it.each(['invalid', 'data:text/html,test', 'ftp://example.com/policy/'])(
    'rejects %s',
    value => {
      expect(policyUrlSchema.safeParse(value).success).toBe(false);
    }
  );
});
