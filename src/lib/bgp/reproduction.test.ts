import { parse } from './parsers';
import { compareRoutes } from './engine';

const realWorldInput = `
BGP routing table entry for 8.8.8.0/24
Last Modified: Dec  9 21:10:04.409 for 7w5d
Paths: (3 available, best #1)

  Path #1: Received by speaker 0
  1299 15169
    62.115.35.116 from 62.115.35.116 (2.255.252.25)
      Origin IGP, localpref 100, valid, external, best, group-best
Communities: 

1299:430
    (RPKI state Valid)

1299:4000 1299:20000 1299:20002 1299:20200


  Path #2: Received by speaker 0
  1299 15169
    81.228.69.237 (metric 2000) from 81.228.63.47 (81.228.65.237)
      Origin IGP, localpref 100, valid, internal
Communities: 

1299:430
    (RPKI state Valid)

1299:4000 1299:20000 1299:20002 1299:20200

      Originator: 81.228.65.237, Cluster list: 81.228.66.11

  Path #3: Received by speaker 0
  1299 15169
    81.228.69.237 (metric 2000) from 81.228.63.48 (81.228.65.237)
      Origin IGP, localpref 100, valid, internal
Communities: 

1299:430
    (RPKI state Valid)

1299:4000 1299:20000 1299:20002 1299:20200

      Originator: 81.228.65.237, Cluster list: 81.228.66.12
`;

describe('Real World Reproduction', () => {
    test('Parses complex Arista/IOS output with metrics and communities', () => {
        const routes = parse(realWorldInput);

        // Should find 3 routes
        expect(routes).toHaveLength(3);

        // Check specific parsing of the tricky lines
        // Path 2 has "(metric 2000)" in the from line
        expect(routes[1].nextHop).toBe('81.228.69.237');
        expect(routes[1].routerId).toBe('81.228.65.237');

        // Path 1 should be best
        const result = compareRoutes(routes);
        expect(result.winner).toBeDefined();
        expect(result.winner?.index).toBe(0); // Best #1

        // Why did it win?
        // Path 1 is External. Path 2/3 are Internal.
        // Step should be "eBGP over iBGP" or higher.
        const ebgpStep = result.steps.find(s => s.stepName === 'eBGP over iBGP');
        expect(ebgpStep).toBeDefined();
        expect(ebgpStep?.winnerIds).toContain(routes[0].id);
    });
});
