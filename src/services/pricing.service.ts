import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PricingService {

  private num(val: any): number {
    return parseFloat(val) || 0;
  }

  drivewayDiscounted(sqft: number): number {
    const area = this.num(sqft);
    if (!area) return 0;
    if (area < 507) return 250;
    if (area > 8000) return area * 0.16;
    const pricePerSqft = 6.58 * Math.pow(area, -0.416);
    const perSqft = Math.max(pricePerSqft, 0.16);
    return perSqft * area;
  }

  crackRepairPrice(feet: number): number {
    const len = this.num(feet);
    if (!len) return 0;
    const flatRate = 2.0;
    const floorRate = 1.50;
    const anchorLength = 100;
    const exponent = 0.3575;
    let ratePerFoot =
      len <= anchorLength
        ? flatRate
        : Math.max(floorRate, flatRate * Math.pow(anchorLength / len, exponent));
    return Math.round(ratePerFoot * len * 100) / 100;
  }

  asphaltRepairPrice(area: number): number {
    const sqft = this.num(area);
    if (!sqft) return 0;
    const total = sqft * 20;
    return Math.max(100, total);
  }

  calculateAll(sqft: number, crackFeet: number, asphaltRepair: number) {
    const drivewayUndiscounted = this.num(sqft) * 0.5;
    const drivewayQuoted = Math.round(this.drivewayDiscounted(sqft));
    const crackUndisc = this.num(crackFeet) * 2.5;
    const crackQuoted = Math.round(this.crackRepairPrice(crackFeet));
    const asphalt = this.asphaltRepairPrice(asphaltRepair);
    const totalUndisc = drivewayUndiscounted + crackUndisc + asphalt;
    const totalQuoted = drivewayQuoted + crackQuoted + asphalt;
    const totalDiscount = totalUndisc - totalQuoted;

    return {
      drivewayUndiscounted,
      drivewayQuoted,
      crackUndisc,
      crackQuoted,
      asphalt,
      totalUndisc,
      totalQuoted,
      totalDiscount,
    };
  }
}
