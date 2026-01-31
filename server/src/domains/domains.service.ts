import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from './entities/domain.entity';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private repo: Repository<Domain>,
  ) { }

  async create(createDomainDto: { name: string }) {
    const exists = await this.repo.findOne({ where: { name: createDomainDto.name } });
    if (exists) return exists;

    const domain = this.repo.create(createDomainDto);
    return this.repo.save(domain);
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [result, total] = await this.repo.findAndCount({
      take: limit,
      skip: skip,
      order: { id: 'DESC' },
    });

    return {
      data: result,
      total: total,
    };
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  async removeAll() {
    await this.repo.clear();
    return { success: true };
  }

  async createMany(names: string[]) {
    if (!names || names.length === 0) return { count: 0 };

    const cleanNames = names
      .map(n => n.trim())
      .filter(n => n.length > 0);

    const existing = await this.repo.find();
    const existingSet = new Set(existing.map(d => d.name));

    const uniqueNewNames = [...new Set(cleanNames)]
      .filter(name => !existingSet.has(name));

    if (uniqueNewNames.length === 0) return { count: 0 };

    const entities = uniqueNewNames.map(name => this.repo.create({ name }));
    await this.repo.save(entities);

    return { count: entities.length };
  }
}