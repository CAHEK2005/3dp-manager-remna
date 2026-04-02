import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../settings/entities/setting.entity';
import { RemnavaveModule } from '../remnawave/remnawave.module';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    RemnavaveModule,
  ],
  controllers: [NodesController],
  providers: [NodesService],
})
export class NodesModule {}
