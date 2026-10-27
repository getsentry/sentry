import {RuleTester} from 'oxlint/plugins-dev';

import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation';

const ruleTester = new RuleTester();
const emotion =
  "import styled from '@emotion/styled'; import {css} from '@emotion/react';\n";

ruleTester.run('no-double-dollar-interpolation', noDoubleDollarInterpolation, {
  valid: [
    {
      name: 'unrelated styled and css bindings are ignored',
      code: 'const styled = {div: x => x}; const css = x => x; const C = styled.div`gap: $${gap};`; const styles = css`color: $${color};`;',
      filename: 'file.tsx',
    },
    {
      code: emotion + 'const C = styled.div`gap: ${p => p.theme.space.md};`;',
      filename: 'file.tsx',
    },
    {
      code: emotion + 'const c = css`color: ${p => p.theme.red};`;',
      filename: 'file.tsx',
    },
    {
      code: emotion + 'const C = styled(Base)`padding: ${gap} ${other};`;',
      filename: 'file.tsx',
    },
    {
      code: emotion + 'const price = `$${amount}`;',
      filename: 'file.tsx',
    },
    {
      code: emotion + 'const C = styled.div`content: "\\$"${x};`;',
      filename: 'file.tsx',
    },
  ],

  invalid: [
    {
      code: emotion + "const C = styled.div`gap: $${p => p.theme.space['2xl']};`;",
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: emotion + "const C = styled.div`gap: ${p => p.theme.space['2xl']};`;",
    },
    {
      code: emotion + 'const c = css`color: $${p => p.theme.red};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: emotion + 'const c = css`color: ${p => p.theme.red};`;',
    },
    {
      code: emotion + 'const C = styled(Base)`margin: ${a}; padding: $${b};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}],
      output: emotion + 'const C = styled(Base)`margin: ${a}; padding: ${b};`;',
    },
    {
      code: emotion + 'const C = styled.div`gap: $${a}; width: $${b};`;',
      filename: 'file.tsx',
      errors: [{messageId: 'doubleDollar'}, {messageId: 'doubleDollar'}],
      output: emotion + 'const C = styled.div`gap: ${a}; width: ${b};`;',
    },
  ],
});
