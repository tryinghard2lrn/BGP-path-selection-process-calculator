import { parse } from './parsers';
import { compareRoutes } from './engine';

const sampleCiscoOutput = `
BGP routing table entry for 192.168.0.0/24, version 10
Paths: (2 available, best #2, table default)
  Advertised to update-groups:
     1
  65001 65002
    10.1.1.1 from 10.1.1.1 (10.1.1.1)
      Origin IGP, localpref 100, valid, external
  65003
    10.2.2.2 from 10.2.2.2 (192.168.1.1)
      Origin IGP, localpref 100, valid, external, best
`;

const tieBreakerOutput = `
BGP routing table entry for 10.0.0.0/8, version 2
Paths: (2 available, best #1)
  65001
    1.1.1.1 from 1.1.1.1 (1.1.1.1)
      Origin IGP, localpref 100, valid, external, best
  65001
    2.2.2.2 from 2.2.2.2 (2.2.2.2)
      Origin IGP, localpref 100, valid, external
`;

describe('BGP Calculator Logic', () => {
    test('Parses Cisco Output and Selects Best Path based on AS Path', () => {
        const routes = parse(sampleCiscoOutput);
        expect(routes).toHaveLength(2);

        const result = compareRoutes(routes);

        // Debug info
        // console.log(JSON.stringify(result, null, 2));

        expect(result.winner).toBeDefined();
        // Route 2 (index 1) has AS path '65003' (len 1) vs '65001 65002' (len 2)
        // Winner should be index 1
        // Wait, my parser assigns IDs randomly. Need to check content.
        expect(result.winner?.nextHop).toBe('10.2.2.2');

        // Check steps
        const asPathStep = result.steps.find(s => s.stepName === 'AS Path Length');
        expect(asPathStep).toBeDefined();
        expect(asPathStep?.reason).toContain('Shorter AS Path');
    });

    test('Tie Breaker on Router ID', () => {
        const routes = parse(tieBreakerOutput);
        // Both len 1, same origin, same MED (0).
        // Router ID 1.1.1.1 vs 2.2.2.2

        const result = compareRoutes(routes);
        expect(result.winner?.nextHop).toBe('1.1.1.1');

        const idStep = result.steps.find(s => s.stepName === 'Router ID');
        expect(idStep).toBeDefined();
        expect(idStep?.winnerIds).toHaveLength(1);
    });
});
