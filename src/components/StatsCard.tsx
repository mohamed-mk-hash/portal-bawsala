import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Stats } from '../types';

interface StatsCardProps {
  stat: Stats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stat }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{stat.label}</p>
          <p className="text-3xl font-bold mt-2">{stat.value}</p>
        </div>
        <div className={`flex items-center text-sm font-medium ${
          stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          {stat.trend === 'up' ? (
            <TrendingUp className="w-4 h-4 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 mr-1" />
          )}
          {stat.change}
        </div>
      </div>
    </div>
  );
};
