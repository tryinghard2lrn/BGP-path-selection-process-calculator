
import { parse } from './parsers';

const userOutput = `
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

describe('User Repro 2 - Metric Parsing', () => {
    test('Parses IGP Metric correctly', () => {
        const routes = parse(userOutput);
        expect(routes).toHaveLength(3);

        // Path 1
        expect(routes[0].igpMetric).toBe(0); // Default, no metric shown

        // Path 2
        expect(routes[1].igpMetric).toBe(2000); // Explicit metric

        // Path 3
        expect(routes[2].igpMetric).toBe(2000); // Explicit metric
    });
});
